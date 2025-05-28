import { BookshelfDuplicateReqDTO } from "./../interfaces/bookshelf/BookshelfDuplicateReqDTO";
import { FriendBookshelfResDTO } from "./../interfaces/bookshelf/FriendBookshelfResDTO";
import { PrismaClient } from "@prisma/client";
import { BookDTO } from "../interfaces/book/BookDTO";
import { BookshelfCreateDTO } from "../interfaces/bookshelf/BookshelfCreateDTO";
import { MyBookshelfResDTO } from "../interfaces/bookshelf/MyBookshelfResDTO";
import { BookshelfUpdateDTO } from "../interfaces/bookshelf/BookshelfUpdateDTO";
import { UserDTO } from "../interfaces/user/UserDTO";
import userService from "./userService";
import { IntroDTO } from "../interfaces/user/IntroDTO";
import { sc } from "../constants";
import { rm } from "fs";
import friendService from "./friendService";
import bookService from "./bookService";
import alarmService from "./alarmService";

const prisma = new PrismaClient();

//* 내 책장에 책 등록
const createMyBook = async (
  userId: number,
  bookshelfCreateDto: BookshelfCreateDTO
) => {
  const bookData = await bookService.getBookId(bookshelfCreateDto);
  let bookId = bookData?.id;
  if (!bookId) {
    bookId = -1;
  }

  if (bookshelfCreateDto.author === null) {
    bookshelfCreateDto.author = "";
  }

  const bookshelf = await prisma.bookshelf.create({
    data: {
      pickIndex: 0,
      description: bookshelfCreateDto.description,
      memo: bookshelfCreateDto.memo,
      User: {
        connect: {
          id: userId,
        },
      },
      Book: {
        connectOrCreate: {
          where: {
            id: bookId,
          },
          create: {
            bookTitle: bookshelfCreateDto.bookTitle,
            author: bookshelfCreateDto.author,
            bookImage: bookshelfCreateDto.bookImage,
            publisher: bookshelfCreateDto.publisher,
          },
        },
      },
    },
  });

  // 나를 팔로우하는 친구들에게 알림 보내기
  const follows = await friendService.getFollowerIdList(userId);
  const alarm = alarmService.createNewBookAlarm(userId, bookshelf, follows);

  return bookshelf;
};

//* 등록한 책 상세 정보 조회
const getBookById = async (bookshelfId: number) => {
  const bookData = await prisma.bookshelf.findUnique({
    where: {
      id: bookshelfId,
    },
    select: {
      description: true,
      memo: true,
      Book: {
        select: {
          bookImage: true,
          bookTitle: true,
          author: true,
        },
      },
    },
  });

  return bookData;
};

//* 등록한 책 삭제
const deleteMyBook = async (bookshelfId: number) => {
  //* 책장에 없는 책을 삭제하려고 하면 에러
  const bookdata = await prisma.bookshelf.findUnique({
    where: {
      id: bookshelfId,
    },
  });

  if (!bookdata) {
    return sc.NOT_FOUND;
  }

  //* pick 되어 있는 책을 삭제하려고 하면 pickIndex 수정
  if (bookdata.pickIndex == 1) {
    for (let idx = 2; idx < 4; idx++) {
      await prisma.bookshelf.updateMany({
        where: {
          userId: bookdata.userId,
          pickIndex: idx,
        },
        data: {
          pickIndex: idx - 1,
        },
      });
    }
  }

  if (bookdata.pickIndex == 2) {
    await prisma.bookshelf.updateMany({
      where: {
        userId: bookdata.userId,
        pickIndex: 3,
      },
      data: {
        pickIndex: 2,
      },
    });
  }

  //* 책 삭제 했을때 알림들 다 삭제됨
  const deleteData = await prisma.newBookAlarm.findMany({
    where: {
      bookshelfId: bookshelfId,
    },
  });

  // alarm DB에서 삭제
  const deletePromise = deleteData.map(async (data) => {
    await prisma.alarm.deleteMany({
      where: {
        id: data.alarmId,
      },
    });
  });
  await Promise.all(deletePromise);

  const data = await prisma.bookshelf.delete({
    where: {
      id: bookshelfId,
    },
  });

  return data;
};

//* 등록한 책 수정
const updateMyBook = async (
  bookshelfId: number,
  bookshelfUpdateDto: BookshelfUpdateDTO
) => {
  //unique한 bookshelfId 값
  const bookshelfData = await prisma.bookshelf.findFirst({
    where: {
      id: bookshelfId,
    },
  });

  if (!bookshelfData) {
    return sc.NOT_FOUND;
  }

  const data = await prisma.bookshelf.update({
    where: {
      id: bookshelfId,
    },
    data: {
      description: bookshelfUpdateDto.description,
      memo: bookshelfUpdateDto.memo,
    },
  });

  return data;
};

//* 내 책장 (메인 뷰) 조회
const getMyBookshelf = async (userId: number) => {
  // section1 : friendList
  let friendList: UserDTO[] = [];
  const friends = friendService.getFriendInfoList(userId);
  for (const friend of await friends) {
    friendList.push(friend);
  }

  // section2 : myIntro
  const myIntro: IntroDTO = await userService.getUserIntro(userId);

  // section3 : picks
  const picks = await prisma.bookshelf.findMany({
    where: {
      userId: userId,
      pickIndex: { in: [1, 2, 3] },
    },
    orderBy: {
      pickIndex: "asc",
    },
    select: {
      id: true,
      pickIndex: true,
      Book: {
        select: {
          id: true,
          bookImage: true,
          bookTitle: true,
        },
      },
      description: true,
    },
  });

  // section4 : books
  const books = await prisma.bookshelf.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      bookId: true,
      pickIndex: true,
      Book: {
        select: {
          bookImage: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const data: MyBookshelfResDTO = {
    friendList: friendList,
    myIntro: myIntro,
    picks: picks,
    bookTotalNum: books.length,
    books: books,
  };

  return data;
};

//* 친구 책장 조회
const getFriendBookshelf = async (userId: number, friendId: number) => {
  //? 친구 테이블에 데이터가 없다면 에러
  const isFriend = friendService.isFriend(userId, friendId);
  if (isFriend == null) {
    return sc.NOT_FOUND;
  }

  // section1 : myIntro
  const userIntro = await userService.getUserIntro(userId);
  const myIntro = {
    nickname: userIntro?.nickname,
    profileImage: userIntro.profileImage,
  };

  // section2 : friendList
  let friendList: UserDTO[] = [];
  const friends = friendService.getFriendInfoList(userId);
  for (const friend of await friends) {
    friendList.push(friend);
  }

  // section3 : friendIntro
  const friendIntro: IntroDTO = await userService.getUserIntro(friendId);

  // section4 : picks
  const picks = await prisma.bookshelf.findMany({
    where: {
      userId: friendId,
      pickIndex: { in: [1, 2, 3] },
    },
    orderBy: {
      pickIndex: "asc",
    },
    select: {
      id: true,
      pickIndex: true,
      Book: {
        select: {
          id: true,
          bookImage: true,
          bookTitle: true,
        },
      },
      description: true,
    },
  });

  // section5 : books
  const books = await prisma.bookshelf.findMany({
    where: {
      userId: friendId,
    },
    select: {
      id: true,
      bookId: true,
      pickIndex: true,
      Book: {
        select: {
          bookImage: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const data: FriendBookshelfResDTO = {
    myIntro: myIntro,
    friendList: friendList,
    friendIntro: friendIntro,
    picks: picks,
    bookTotalNum: books.length,
    books: books,
  };

  return data;
};

//* 책 등록 시, 중복 확인
const checkDuplicateBook = async (
  bookshelfDuplicateReqDTO: BookshelfDuplicateReqDTO,
  userId: number
) => {
  const bookData = await prisma.book.findFirst({
    where: {
      bookTitle: bookshelfDuplicateReqDTO.bookTitle,
      author: bookshelfDuplicateReqDTO.author,
      publisher: bookshelfDuplicateReqDTO.publisher,
    },
  });

  if (!bookData) {
    return { isDuplicate: false };
  }

  const bookshelfData = await prisma.bookshelf.findFirst({
    where: {
      bookId: bookData.id,
      userId,
    },
  });

  return { isDuplicate: !!bookshelfData };
};

const bookshelfService = {
  createMyBook,
  getBookById,
  deleteMyBook,
  updateMyBook,
  getMyBookshelf,
  getFriendBookshelf,
  checkDuplicateBook,
};

export default bookshelfService;
