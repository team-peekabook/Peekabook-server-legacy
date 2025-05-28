import { Bookshelf, PrismaClient } from "@prisma/client";
import dayjs from "dayjs";
import { AlarmResponseDTO } from "../interfaces/alarm/AlarmResponseDTO";
import admin from "../config/pushConfig";
import { createPushMessage } from "../modules/pushNotificationMessage";

const prisma = new PrismaClient();

//* 알림 조회
const getAlarm = async (auth: number) => {
  let alarmAll: AlarmResponseDTO[] = [];

  const alarmData = await prisma.alarm.findMany({
    where: {
      receiverId: auth,
    },
    select: {
      id: true,
      typeId: true,
      senderId: true,
      createdAt: true,
    },
  });

  const promises = alarmData.map(async (data) => {
    //? 팔로우 한 경우
    if (data.typeId === 1 || data.typeId === 4) {
      const userData = await prisma.user.findFirst({
        where: {
          id: data.senderId,
        },
        select: {
          profileImage: true,
          nickname: true,
        },
      });

      if (userData != null) {
        const followResult = {
          alarmId: data.id,
          typeId: data.typeId,
          senderId: data.senderId,
          senderName: userData.nickname,
          profileImage: userData?.profileImage,
          createdAt: dayjs(data.createdAt).format("YYYY-MM-DD"),
        };
        alarmAll.push(followResult);
      }
    }

    //? 친구 책 추천한 경우
    if (data.typeId === 2) {
      const bookIds = await prisma.recommendAlarm.findFirst({
        where: {
          alarmId: data.id,
        },
        select: {
          Recommend: {
            select: {
              bookId: true,
            },
          },
        },
      });

      const bookDetail = await prisma.book.findFirst({
        where: {
          id: bookIds?.Recommend.bookId,
        },
        select: {
          bookTitle: true,
        },
      });

      const userData = await prisma.user.findFirst({
        where: {
          id: data.senderId,
        },
        select: {
          profileImage: true,
          nickname: true,
        },
      });

      if (userData != null) {
        const bookResult = {
          alarmId: data.id,
          typeId: data.typeId,
          senderId: data.senderId,
          senderName: userData.nickname,
          profileImage: userData?.profileImage,
          createdAt: dayjs(data.createdAt).format("YYYY-MM-DD"),
          bookTitle: bookDetail?.bookTitle,
        };
        alarmAll.push(bookResult);
      }
    }
    //? 책 추가한 경우
    if (data.typeId === 3) {
      const bookIds = await prisma.newBookAlarm.findFirst({
        where: {
          alarmId: data.id,
        },
        select: {
          Bookshelf: {
            select: {
              bookId: true,
            },
          },
        },
      });

      const bookDetail = await prisma.book.findFirst({
        where: {
          id: bookIds?.Bookshelf.bookId,
        },
        select: {
          bookTitle: true,
        },
      });

      const userData = await prisma.user.findFirst({
        where: {
          id: data.senderId,
        },
        select: {
          profileImage: true,
          nickname: true,
        },
      });

      if (userData != null) {
        const bookResult = {
          alarmId: data.id,
          typeId: data.typeId,
          senderId: data.senderId,
          senderName: userData.nickname,
          profileImage: userData?.profileImage,
          bookTitle: bookDetail?.bookTitle,
          createdAt: dayjs(data.createdAt).format("YYYY-MM-DD"),
        };
        alarmAll.push(bookResult);
      }
    }
  });
  await Promise.all(promises);

  alarmAll.sort(function (a, b) {
    return a.alarmId > b.alarmId ? -1 : a.alarmId > b.alarmId ? 1 : 0;
  });

  return alarmAll;
};

// 푸시 알림 보내는 함수
async function sendPushNotification(receiverUser: any, senderUser: any) {
  if (receiverUser?.fcm_token) {
    const pushTitle = `📚 '${senderUser.nickname}'님이 새로운 책을 책장에 추가했어요!`;
    const pushBody = `${senderUser.nickname}님이 어떤 책을 읽었는지 지금 바로 알아보세요`;

    const pushMessage = createPushMessage(
      receiverUser.fcm_token,
      pushTitle,
      pushBody
    );

    admin
      .messaging()
      .send(pushMessage)
      .then((res: any) => {
        console.log("Success sent message : ", res);
      })
      .catch((err: any) => {
        console.log("Error Sending message !! : ", err);
      });
  }
}

//* 책 등록 시 알림 생성
const createNewBookAlarm = async (
  userId: number,
  bookshelf: Bookshelf,
  follows: { senderId: number }[]
) => {
  const senderUser = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });

  for (const follow of follows) {
    const alarm = await prisma.alarm.create({
      data: {
        senderId: userId,
        receiverId: follow.senderId,
        typeId: 3,
      },
    });

    await prisma.newBookAlarm.create({
      data: {
        alarmId: alarm.id,
        bookshelfId: bookshelf.id,
      },
    });

    // 푸시 알림 보내기
    const receiverUser = await prisma.user.findFirst({
      where: {
        id: follow.senderId,
      },
    });

    await sendPushNotification(receiverUser, senderUser);
  }
};

const deleteAlarm = async (userId: number, friendId: number) => {
  await prisma.alarm.deleteMany({
    where: {
      receiverId: userId,
      senderId: friendId,
    },
  });

  await prisma.alarm.deleteMany({
    where: {
      receiverId: friendId,
      senderId: userId,
    },
  });
};

const alarmService = {
  getAlarm,
  createNewBookAlarm,
  deleteAlarm,
};

export default alarmService;
