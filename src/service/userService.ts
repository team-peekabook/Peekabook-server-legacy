import { PrismaClient } from "@prisma/client";
import { IntroDTO } from "../interfaces/user/IntroDTO";
import { UserDTO } from "../interfaces/user/UserDTO";
import { UserVersionDTO } from "../interfaces/user/UserVersionDTO";
import { sc } from "../constants";

const prisma = new PrismaClient();

//* 사용자 조회
const getUser = async (userId: number): Promise<UserDTO> => {
  const userData = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      id: true,
      nickname: true,
      profileImage: true,
    },
  });
  if (!userData) throw new Error("no user!");

  return userData;
};

//* 사용자 정보 조회
const getUserIntro = async (userId: number) => {
  const userIntro: IntroDTO | null = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      nickname: true,
      profileImage: true,
      intro: true,
    },
  });
  if (!userIntro) throw sc.UNAUTHORIZED;

  return userIntro;
};

//* 유저닉네임 중복 검사
const postDuplicateNickname = async (userId: number, nickname: string) => {
  let isExisted = 1;

  const lowercaseNickname: string = nickname.toLowerCase();

  const userCheck = await prisma.user.findFirst({
    where: {
      nickname: {
        equals: lowercaseNickname,
      },
    },
    select: {
      nickname: true,
    },
  });

  if (!userCheck) {
    isExisted = 0;
  }

  const data = {
    check: isExisted,
  };
  return data;
};

//* refreshToken으로 유저 검색
const getUserByRfToken = async (refreshToken: string) => {
  const user = prisma.user.findFirst({
    where: {
      refresh_token: refreshToken,
    },
  });

  return user;
};

const getUserVersion = async (): Promise<UserVersionDTO | null> => {
  const versionData = await prisma.version.findUnique({
    where: {
      id: 1,
    },
    select: {
      imageUrl: true,
      iosForceVersion: true,
      androidForceVersion: true,
      text: true,
    },
  });

  if (!versionData) {
    return null;
  }

  const userVersionDTO: UserVersionDTO = {
    androidForceVersion: versionData.androidForceVersion || "",
    imageUrl: versionData.imageUrl || "",
    text: versionData.text || "",
    iosForceVersion: versionData.iosForceVersion || "",
  };

  return userVersionDTO;
};

const userService = {
  getUser,
  getUserIntro,
  postDuplicateNickname,
  getUserByRfToken,
  getUserVersion,
};

export default userService;
