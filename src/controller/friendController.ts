import { FriendRecommendRequestDTO } from "./../interfaces/friend/FriendRecommendRequestDTO";
import { Request, Response } from "express";
import { fail, success } from "../constants/response";
import { rm, sc } from "../constants";
import { friendService } from "../service";
import { slackErrorMessage } from "../modules/slack/slackErrorMessage";
import { FriendReportRequestDTO } from "../interfaces/friend/FriendReportRequestDTO";
import { mailSender } from "../modules/mail";
import { ReportMailRequestDTO } from "../interfaces/friend/ReportMailRequestDTO";
import { reportMessage } from "../modules/reportMessage";
import { userService } from "../service";
import { reportMailDTO } from "../interfaces/friend/reportMailDTO";
import blockService from "../service/blockService";
import { sendWebhookErrorMessage } from "../modules/slack/slackWebhook";

//* 친구에게 책 추천하기
const recommendBookToFriend = async (req: Request, res: Response) => {
  const { friendId } = req.params;
  const friendRecommendRequestDTO: FriendRecommendRequestDTO = req.body;
  const userId = req.body.userId;

  const refinedRecommendDesc = friendRecommendRequestDTO.recommendDesc.replace(
    /\n/g,
    " "
  );
  friendRecommendRequestDTO.recommendDesc = refinedRecommendDesc;

  if (!userId) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.BAD_REQUEST));
  }

  if (!friendId) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.NOT_FOUND_FRIEND_ID));
  }
  try {
    const data = await friendService.recommendBookToFriend(
      friendRecommendRequestDTO,
      +friendId,
      +userId
    );

    if (!data) {
      return res
        .status(sc.BAD_REQUEST)
        .send(fail(sc.BAD_REQUEST, rm.FAIL_RECOMMEND_BOOK));
    }

    if (data == sc.NOT_FOUND) {
      return res
        .status(sc.NOT_FOUND)
        .send(fail(sc.NOT_FOUND, rm.FAIL_NO_FRIEND));
    }

    return res
      .status(sc.OK)
      .send(success(sc.OK, rm.SUCCESS_RECOMMEND_BOOK, data));
  } catch (error) {
    const errorMessage = slackErrorMessage(
      req.method.toUpperCase(),
      req.originalUrl,
      error,
      req.statusCode
    );

    sendWebhookErrorMessage(errorMessage);

    res
      .status(sc.INTERNAL_SERVER_ERROR)
      .send(fail(sc.INTERNAL_SERVER_ERROR, rm.INTERNAL_SERVER_ERROR));
  }
};

//* 사용자 검색하기
const searchUser = async (req: Request, res: Response) => {
  const { nickname } = req.query;
  const userId = req.body.userId;
  if (!userId) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.BAD_REQUEST));
  }

  if (!nickname) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.NOT_FOUND_FRIEND_ID));
  }

  try {
    const data = await friendService.searchUser(nickname as string, +userId);

    if (!data) {
      return res
        .status(sc.BAD_REQUEST)
        .send(fail(sc.BAD_REQUEST, rm.FAIL_NO_FRIEND_EXIST));
    }

    return res.status(sc.OK).send(success(sc.OK, rm.SUCCESS_GET_USER, data));
  } catch (error) {
    const errorMessage = slackErrorMessage(
      req.method.toUpperCase(),
      req.originalUrl,
      error,
      req.statusCode
    );

    sendWebhookErrorMessage(errorMessage);

    res
      .status(sc.INTERNAL_SERVER_ERROR)
      .send(fail(sc.INTERNAL_SERVER_ERROR, rm.INTERNAL_SERVER_ERROR));
  }
};

//* 사용자 팔로우 하기
const followFriend = async (req: Request, res: Response) => {
  const { friendId } = req.params;
  const userId = req.body.userId;
  if (!userId) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.BAD_REQUEST));
  }

  if (!friendId) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.NOT_FOUND_FRIEND_ID));
  }
  try {
    const data = await friendService.followFriend(+friendId, +userId);

    if (!data) {
      return res
        .status(sc.BAD_REQUEST)
        .send(fail(sc.BAD_REQUEST, rm.FAIL_POST_FOLLOW));
    }
    return res.status(sc.OK).send(success(sc.OK, rm.SUCCESS_POST_FOLLOW, data));
  } catch (error) {
    const errorMessage = slackErrorMessage(
      req.method.toUpperCase(),
      req.originalUrl,
      error,
      req.statusCode
    );

    sendWebhookErrorMessage(errorMessage);

    res
      .status(sc.INTERNAL_SERVER_ERROR)
      .send(fail(sc.INTERNAL_SERVER_ERROR, rm.INTERNAL_SERVER_ERROR));
  }
};

/**
 * @route DELETE /friend/:friendId
 * @desc 팔로우 취소하기
 **/
const deleteFollowFriend = async (req: Request, res: Response) => {
  const { friendId } = req.params;
  const auth = req.body.userId;

  if (!friendId) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.BAD_REQUEST));
  }

  try {
    const data = await friendService.deleteFollowFriend(+friendId, +auth);

    if (data === sc.NOT_FOUND) {
      return res
        .status(sc.NOT_FOUND)
        .send(fail(sc.NOT_FOUND, rm.NOT_FOUND_FRIEND_ID));
    }

    return res.status(sc.OK).send(success(sc.OK, rm.DELETE_FRIEND_SUCCESS));
  } catch (error) {
    const errorMessage = slackErrorMessage(
      req.method.toUpperCase(),
      req.originalUrl,
      error,
      req.statusCode
    );

    sendWebhookErrorMessage(errorMessage);

    res
      .status(sc.INTERNAL_SERVER_ERROR)
      .send(fail(sc.INTERNAL_SERVER_ERROR, rm.INTERNAL_SERVER_ERROR));
  }
};

//* 친구 신고하기
const postReport = async (req: Request, res: Response) => {
  const { friendId } = req.params;
  const friendReportRequestDto: FriendReportRequestDTO = req.body;
  const userId = req.body.userId;

  if (!userId) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.BAD_REQUEST));
  }

  if (!friendId) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.FAIL_FOUND_FRIEND_ID));
  }

  if (!friendReportRequestDto.reasonIndex) {
    return res
      .status(sc.BAD_REQUEST)
      .send(fail(sc.BAD_REQUEST, rm.FAIL_REPORT_POST));
  }

  try {
    const data = await friendService.postReport(
      +userId,
      +friendId,
      friendReportRequestDto
    );

    if (!data) {
      return res
        .status(sc.BAD_REQUEST)
        .send(fail(sc.BAD_REQUEST, rm.FAIL_REPORT_POST));
    }

    postMail(friendReportRequestDto, +friendId, +userId);

    return res.status(sc.OK).send(success(sc.OK, rm.SUCCESS_REPORT_POST));
  } catch (error) {
    const errorMessage = slackErrorMessage(
      req.method.toUpperCase(),
      req.originalUrl,
      error,
      req.statusCode
    );

    sendWebhookErrorMessage(errorMessage);

    res
      .status(sc.INTERNAL_SERVER_ERROR)
      .send(fail(sc.INTERNAL_SERVER_ERROR, rm.INTERNAL_SERVER_ERROR));
  }
};

const postMail = async (
  friendReportRequestDto: FriendReportRequestDTO,
  friendId: number,
  userId: number
) => {
  const userName = await userService.getUserIntro(userId);
  const friendName = await userService.getUserIntro(friendId);
  let reasonString = "reason";
  switch (friendReportRequestDto.reasonIndex) {
    case 1:
      reasonString = rm.REASON_ONE;
      break;
    case 2:
      reasonString = rm.REASON_TWO;
      break;
    case 3:
      reasonString = rm.REASON_THREE;
      break;
    case 4:
      reasonString = rm.REASON_FOUR;
      break;
    default:
      reasonString = rm.REASON_FIVE;
      break;
  }

  if (friendReportRequestDto.etc == null) {
    friendReportRequestDto.etc = "구체적 사유 없습니다.";
  }
  const reportMailDTO: reportMailDTO = {
    userNickname: userName.nickname,
    userId: userId,
    friendNickname: friendName.nickname,
    friendId: friendId,
    reasonString: reasonString,
    etc: friendReportRequestDto.etc,
  };

  const message = reportMessage(reportMailDTO);

  const reportMailRequest: ReportMailRequestDTO = {
    mailTitle: rm.MAIL_TITLE,
    text: message,
  };

  mailSender.sendGmail(reportMailRequest);
};

/**
 * @route POST /friend/block/:friendId
 * @desc 친구 차단하기
 **/
const blockFriend = async (req: Request, res: Response) => {
  const { friendId } = req.params;
  //* middleware로 auth 받기
  const userId = req.body.userId;

  if (!friendId) {
    return res.status(sc.BAD_REQUEST).send(fail(sc.BAD_REQUEST, rm.NULL_VALUE));
  }

  try {
    const data = await blockService.blockFriend(+userId, +friendId);

    if (!data) {
      return res
        .status(sc.BAD_REQUEST)
        .send(fail(sc.BAD_REQUEST, rm.BAD_REQUEST));
    }
    return res.status(sc.OK).send(success(sc.OK, rm.SUCCESS_BLOCK_FRIEND));
  } catch (error) {
    const errorMessage = slackErrorMessage(
      req.method.toUpperCase(),
      req.originalUrl,
      error,
      req.statusCode
    );
    sendWebhookErrorMessage(errorMessage);
    res
      .status(sc.INTERNAL_SERVER_ERROR)
      .send(fail(sc.INTERNAL_SERVER_ERROR, rm.INTERNAL_SERVER_ERROR));
  }
};

const friendController = {
  recommendBookToFriend,
  searchUser,
  followFriend,
  deleteFollowFriend,
  postReport,
  blockFriend,
};

export default friendController;
