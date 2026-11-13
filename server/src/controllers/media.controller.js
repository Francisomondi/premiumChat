
import {
  createVideoUploadSchema,
} from "../validators/media.validator.js";

import {
  createVideoUpload,
  completeVideoUpload,
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
