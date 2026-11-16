
import mongoose from "mongoose";

import Media, {
  MEDIA_STATUSES,
  MEDIA_MODERATION_STATUSES,
  MEDIA_PUBLICATION_STATUSES,
} from "../models/Media.model.js";


import { createPrivateReadUrl } from "./storage.service.js";

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function formatModerationMedia(media) {
  return {
    id: String(media._id),
    creatorId: String(media.creatorId),
    creatorProfileId: String(media.creatorProfileId),
    title: media.title,
    description: media.description,
    mediaType: media.mediaType,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    processedSizeBytes: media.processedSizeBytes,
    durationSeconds: media.durationSeconds,
    width: media.width,
    height: media.height,
    status: media.status,
    moderationStatus: media.moderationStatus,
    publicationStatus: media.publicationStatus,
    accessPolicy: media.accessPolicy,
    priceKes: media.priceKes,
    rejectionReason: media.rejectionReason,
    moderatedBy: media.moderatedBy
      ? String(media.moderatedBy)
      : null,
    moderatedAt: media.moderatedAt,
    uploadedAt: media.uploadedAt,
    processingCompletedAt: media.processingCompletedAt,
    createdAt: media.createdAt,
  };
}

export async function getPendingMediaModeration() {
  const media = await Media.find({
    status: MEDIA_STATUSES.READY,
    moderationStatus: MEDIA_MODERATION_STATUSES.PENDING,
    publicationStatus: MEDIA_PUBLICATION_STATUSES.DRAFT,
  })
    .sort({ processingCompletedAt: 1, createdAt: 1 })
    .limit(100);

  return media.map(formatModerationMedia);
}

export async function reviewMedia({
  mediaId,
  adminId,
  decision,
  rejectionReason = "",
}) {
  if (!mongoose.isValidObjectId(mediaId)) {
    throw createError("Invalid media ID.", 400);
  }

  if (
    ![
      MEDIA_MODERATION_STATUSES.APPROVED,
      MEDIA_MODERATION_STATUSES.REJECTED,
    ].includes(decision)
  ) {
    throw createError("Invalid moderation decision.", 400);
  }

  const reason = String(rejectionReason || "").trim();

  if (
    decision === MEDIA_MODERATION_STATUSES.REJECTED &&
    reason.length < 5
  ) {
    throw createError(
      "A rejection reason of at least 5 characters is required.",
      400,
    );
  }

  if (reason.length > 1000) {
    throw createError(
      "The rejection reason cannot exceed 1000 characters.",
      400,
    );
  }

  const updatedMedia = await Media.findOneAndUpdate(
    {
      _id: mediaId,
      status: MEDIA_STATUSES.READY,
      moderationStatus: MEDIA_MODERATION_STATUSES.PENDING,
      publicationStatus: MEDIA_PUBLICATION_STATUSES.DRAFT,
    },
    {
      $set: {
        moderationStatus: decision,
        rejectionReason:
          decision === MEDIA_MODERATION_STATUSES.REJECTED
            ? reason
            : "",
        moderatedBy: adminId,
        moderatedAt: new Date(),
        publicationStatus: MEDIA_PUBLICATION_STATUSES.DRAFT,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (updatedMedia) {
    return formatModerationMedia(updatedMedia);
  }

  const existingMedia = await Media.findById(mediaId);

  if (!existingMedia) {
    throw createError("Media record was not found.", 404);
  }

  if (existingMedia.status !== MEDIA_STATUSES.READY) {
    throw createError(
      "Only successfully processed videos can be moderated.",
      409,
    );
  }

  if (
    existingMedia.moderationStatus !==
    MEDIA_MODERATION_STATUSES.PENDING
  ) {
    throw createError(
      "This video has already received a moderation decision.",
      409,
    );
  }

  throw createError(
    "This video is no longer awaiting moderation.",
    409,
  );
}


export async function getMediaModerationPreview(mediaId) {
  if (!mongoose.isValidObjectId(mediaId)) {
    throw createError("Invalid media ID.", 400);
  }

  const media = await Media.findOne({
    _id: mediaId,
    status: MEDIA_STATUSES.READY,
    moderationStatus: MEDIA_MODERATION_STATUSES.PENDING,
    publicationStatus: MEDIA_PUBLICATION_STATUSES.DRAFT,
  }).select("+processedStorageKey");

  if (!media) {
    throw createError(
      "Video was not found or is no longer awaiting moderation.",
      404,
    );
  }

  if (!media.processedStorageKey) {
    throw createError(
      "The processed video is not available for preview.",
      409,
    );
  }

  const previewUrl = await createPrivateReadUrl({
    storageKey: media.processedStorageKey,
    expiresIn: 180,
    contentType: "video/mp4",
  });

  return {
    previewUrl,
    expiresIn: 180,
    mediaId: String(media._id),
  };
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