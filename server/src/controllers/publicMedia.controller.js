import {
  getPublicVideoFeed,
  getPublicCreatorVideos,
  getPublicVideoPlayback,
} from "../services/publicMedia.service.js";

export async function getPublicVideoFeedRequest(req, res, next) {
  try {
    const result = await getPublicVideoFeed({
      user: req.user,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPublicCreatorVideosRequest(req, res, next) {
  try {
    const result = await getPublicCreatorVideos({
      user: req.user,
      username: req.params.username,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPublicVideoPlaybackRequest(req, res, next) {
  try {
    const result = await getPublicVideoPlayback({
      user: req.user,
      mediaId: req.params.mediaId,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}