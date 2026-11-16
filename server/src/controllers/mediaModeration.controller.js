
import {
  getPendingMediaModeration,
  reviewMedia,
  getMediaModerationPreview,
} from "../services/mediaModeration.service.js";


export async function getModerationQueue(req, res, next) {
  try {
    const media = await getPendingMediaModeration();

    return res.status(200).json({
      success: true,
      media,
      count: media.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function reviewMediaRequest(req, res, next) {
  try {
    const { decision, rejectionReason } = req.body || {};

    if (
      !["APPROVED", "REJECTED"].includes(decision)
    ) {
      return res.status(400).json({
        success: false,
        message: "Decision must be APPROVED or REJECTED.",
      });
    }

    if (
      rejectionReason !== undefined &&
      typeof rejectionReason !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be text.",
      });
    }

    const media = await reviewMedia({
      mediaId: req.params.mediaId,
      adminId: req.user._id,
      decision,
      rejectionReason,
    });

    return res.status(200).json({
      success: true,
      message:
        decision === "APPROVED"
          ? "Video approved successfully."
          : "Video rejected successfully.",
      media,
    });
  } catch (error) {
    return next(error);
  }
}
export async function getMediaModerationPreviewRequest(
  req,
  res,
  next,
) {
  try {
    const preview = await getMediaModerationPreview(
      req.params.mediaId,
    );

    return res.status(200).json({
      success: true,
      preview,
    });
  } catch (error) {
    return next(error);
  }
}