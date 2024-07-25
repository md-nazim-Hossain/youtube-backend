import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import StatusCode from "http-status-codes";
import ApiError from "../utils/ApiError.js";
import { getUserIdFromToken } from "../utils/jwt.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
// import { redisClient } from "../db/redisClient.js";

const getAllContentsByType = catchAsync(async (req, res) => {
  const limit = req.query.limit || 10;
  const skip = req.query.skip || 0;
  const type = req.query.type || "video";
  const totalContent = await Video.countDocuments({});
  const content = await Video.aggregate([
    { $match: { isPublished: true, type } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $project: { password: 0, refreshToken: 0, accessToken: 0 } },
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          { $addFields: { subscribersCount: { $size: "$subscribers" } } },
          { $project: { subscribers: 0 } },
        ],
      },
    },
    { $skip: skip },
    { $limit: limit },
    { $sort: { createdAt: -1 } },
    { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
  ]);
  if (!content || content.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: {
        data: [],
        total: totalContent,
      },
      message: "No content found",
    });
  // await redisClient.set(req.originalUrl, JSON.stringify({ data: content, total: totalContent }), { EX: 21600 });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: {
      data: content,
      total: totalContent,
    },
    message: "Content found successfully",
  });
});

const getAllShorts = catchAsync(async (req, res) => {
  let userId = getUserIdFromToken(req);
  if (userId) userId = new mongoose.Types.ObjectId(userId);
  const video = await Video.aggregate([
    { $match: { type: "short", isPublished: true } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $lookup: { from: "subscriptions", localField: "_id", foreignField: "channel", as: "subscribers" } },
          { $project: { password: 0, refreshToken: 0, accessToken: 0, watchHistory: 0 } },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: { $in: [userId, "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          { $project: { subscribers: 0 } },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    { $lookup: { from: "likes", localField: "_id", foreignField: "video", as: "likes" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        isLiked: {
          $cond: { if: { $in: [userId, "$likes.likedBy"] }, then: true, else: false },
        },
      },
    },
    { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
  ]);
  if (!video || video.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No content found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Content found successfully",
  });
});

const getVideoById = catchAsync(async (req, res) => {
  if (!req.params.id) throw new Error("Id is required");
  let userId = getUserIdFromToken(req);
  if (userId) userId = new mongoose.Types.ObjectId(userId);
  const video = await Video.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $lookup: { from: "subscriptions", localField: "_id", foreignField: "channel", as: "subscribers" } },
          { $project: { password: 0, refreshToken: 0, accessToken: 0, watchHistory: 0, lastPasswordChange: 0 } },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: { $in: [userId, "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          { $project: { subscribers: 0 } },
        ],
      },
    },

    { $lookup: { from: "likes", localField: "_id", foreignField: "video", as: "likes" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        isLiked: {
          $cond: { if: { $in: [userId, "$likes.likedBy"] }, then: true, else: false },
        },
      },
    },
    { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
  ]);

  if (!video || video.length === 0 || !video?.[0]?.isPublished)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: null,
      message: "No video found or video is not published",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video[0],
    message: "Video found successfully",
  });
});

const getVideoByUserId = catchAsync(async (req, res) => {
  if (!req.params.id) throw new ApiError(StatusCode.BAD_REQUEST, "User id is required");
  const type = req.query.type || "video";
  const totalVideos = await Video.countDocuments({ owner: req.params.id, isPublished: true, type });
  const videos = await Video.find({ owner: req.params.id, isPublished: true, type })
    .sort({ createdAt: -1 })
    .populate("owner", "-password -refreshToken -watchHistory")
    .exec();

  if (!videos || videos.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No videos found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: {
      data: videos,
      total: totalVideos,
    },
    message: "Videos found successfully",
  });
});

const getAllUserContentByType = catchAsync(async (req, res) => {
  const type = req.query.type || "video";
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const videos = await Video.aggregate([
    { $match: { owner: userId, type } },

    { $lookup: { from: "comments", localField: "_id", foreignField: "video", as: "comments" } },
    { $lookup: { from: "likes", localField: "_id", foreignField: "video", as: "likes" } },
    { $lookup: { from: "playlists", localField: "_id", foreignField: "videos", as: "playlists" } },
    {
      $addFields: {
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
        isLiked: {
          $cond: { if: { $in: [userId, "$likes.likedBy"] }, then: true, else: false },
        },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
  if (!videos)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No videos found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: videos,
    message: "Videos found successfully",
  });
});

const getAllSearchContent = catchAsync(async (req, res) => {
  const { search_query } = req.query;
  if (!search_query?.trim()) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Search query is required");
  }
  const searchQuery = search_query.trim();
  const q = new RegExp(searchQuery, "i");
  const content = await Video.find({
    $or: [{ title: { $regex: q } }, { description: { $regex: q } }],
    isPublished: true,
  })
    .populate("owner", "-password -refreshToken -watchHistory -lastPasswordChange")
    .sort({ createdAt: -1 });

  if (!content || content.length === 0)
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: [],
      message: "No videos found",
    });
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: content,
    message: "Videos found successfully",
  });
});

const updateViewCount = catchAsync(async (req, res) => {
  const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
  if (!video) throw new ApiError("Video not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video updated successfully",
  });
});

const uploadVideo = catchAsync(async (req, res) => {
  const { title, description, isPublished } = req.body;
  if (!title || !description) {
    throw new Error("Title and description are required");
  }
  const videoFilesLocalPath = req.files.videoFiles?.[0]?.path;
  const thumbnailFilesLocalPath = req.files.thumbnail?.[0]?.path;

  if (!videoFilesLocalPath || !thumbnailFilesLocalPath) {
    throw new Error("Video files and thumbnail files are required");
  }

  const videoFiles = await uploadOnCloudinary(videoFilesLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);

  if (!videoFiles || !thumbnail) {
    throw new Error("Error uploading files to cloudinary");
  }
  const { url, duration } = videoFiles;

  const uploadVideos = await Video.create({
    description,
    title,
    videoFile: url,
    thumbnail: thumbnail.url,
    duration,
    isPublished,
    owner: new mongoose.Types.ObjectId(req.user._id),
  });

  if (!uploadVideos) {
    throw new Error("Error save to uploading video into db");
  }

  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: uploadVideos,
    message: "Video uploaded successfully",
  });
});

const updateVideo = catchAsync(async (req, res) => {
  const { title, description, isPublished, thumbnail } = req.body;
  if (!title || !description || !thumbnail || !isPublished) {
    throw new Error("One field is required");
  }

  const thumbnailFilesLocalPath = req.files.thumbnail?.[0]?.path;

  if (thumbnailFilesLocalPath) {
    const thumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);
    if (!thumbnail) {
      throw new Error("Error uploading files to cloudinary");
    }
    req.body.thumbnail = thumbnail.url;
  }

  const video = await Video.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!video) throw new Error("Video not found");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: video,
    message: "Video updated successfully",
  });
});

const makeACopy = catchAsync(async (req, res) => {
  const content = await Video.findById(req.params.id);
  if (!content) throw new Error("Video not found");
  const newContent = await Video.create({
    description: content.description,
    title: content.title,
    videoFile: content.videoFile,
    thumbnail: content.thumbnail,
    duration: content.duration,
    isPublished: content.isPublished,
    type: content.type,
    owner: new mongoose.Types.ObjectId(content.owner),
  });
  if (!newContent) throw new Error("Error creating new video");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: newContent,
    message: "Content copied successfully",
  });
});

const deleteVideo = catchAsync(async (req, res) => {
  const id = req.params.id;
  const session = await mongoose.startSession();
  try {
    const video = await Video.findByIdAndDelete(id, { session });
    if (!video.ok) throw new ApiError(StatusCode.NOT_FOUND, "Video not found");
    const comment = await Comment.deleteMany({ video: new mongoose.Types.ObjectId(id) }, { session });
    if (!comment) throw new ApiError(StatusCode.BAD_REQUEST, "Failed to video comment delete");

    const likes = await Like.deleteMany({ video: new mongoose.Types.ObjectId(id) }, { session });
    if (!likes) throw new ApiError(StatusCode.BAD_REQUEST, "Failed to delete video likes");
    await session.commitTransaction();
    await session.endSession();
    return sendApiResponse({
      res,
      statusCode: StatusCode.OK,
      data: video,
      message: "Video deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
});

export const videoController = {
  uploadVideo,
  deleteVideo,
  getVideoById,
  getAllContentsByType,
  getVideoByUserId,
  getAllUserContentByType,
  updateVideo,
  makeACopy,
  getAllShorts,
  getAllSearchContent,
  updateViewCount,
};
