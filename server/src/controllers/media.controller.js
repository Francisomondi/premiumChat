
import {
  createVideoUploadSchema,
} from "../validators/media.validator.js";

import {
  createVideoUpload,
  completeVideoUpload,
  getCreatorMedia,
  publishCreatorMedia,
  unpublishCreatorMedia,
} from "../services/media.service.js";

function sendValidationError(res, error) {
  return res.status(400).json({
    success: false,
    message: "Please check the submitted information.",
    errors: error.issues?.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function requestVideoUpload(req, res, next) {
  try {
    const validation = createVideoUploadSchema.safeParse(
      req.body,
    );

    if (!validation.success) {
      return sendValidationError(res, validation.error);
    }

    const result = await createVideoUpload({
      user: req.user,
      payload: validation.data,
    });

    return res.status(201).json({
      success: true,
      message: "Video upload session created.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function completeVideoUploadRequest(
  req,
  res,
  next,
) {
  try {
    const media = await completeVideoUpload({
      userId: req.user._id,
      mediaId: req.params.mediaId,
    });

    return res.status(200).json({
      success: true,
      message: "Video uploaded and queued for processing.",
      media,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMyMedia(req, res, next) {
  try {
    const media = await getCreatorMedia({
      userId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      media,
      count: media.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function publishCreatorMediaRequest(
  req,
  res,
  next,
) {
  try {
    const media = await publishCreatorMedia({
      userId: req.user._id,
      mediaId: req.params.mediaId,
    });

    return res.status(200).json({
      success: true,
      message: "Your video is now published.",
      media,
    });
  } catch (error) {
    return next(error);
  }
}

export async function unpublishCreatorMediaRequest(
  req,
  res,
  next,
) {
  try {
    const media = await unpublishCreatorMedia({
      userId: req.user._id,
      mediaId: req.params.mediaId,
    });

    return res.status(200).json({
      success: true,
      message: "Your video has been unpublished.",
      media,
    });
  } catch (error) {
    return next(error);
  }
}
