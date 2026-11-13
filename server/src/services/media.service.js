
import { randomUUID } from "node:crypto";

import CreatorProfile from "../models/CreatorProfile.model.js";
import Media, {
  MEDIA_STATUSES,
} from "../models/Media.model.js";

import {
  createVideoUploadUrl,
  getPrivateObjectMetadata,
} from "./storage.service.js";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const UPLOAD_URL_LIFETIME_MS = 10 * 60 * 1000;

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getVideoExtension(mimeType) {
  if (mimeType === "video/mp4") {
    return "mp4";
  }

  if (mimeType === "video/webm") {
    return "webm";
  }

  throw createError("Unsupported video format.");
}

function formatMedia(media) {
  return {
    id: String(media._id),
    title: media.title,
    description: media.description,
    mediaType: media.mediaType,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    status: media.status,
    moderationStatus: media.moderationStatus,
    publicationStatus: media.publicationStatus,
    accessPolicy: media.accessPolicy,
    createdAt: media.createdAt,
    uploadedAt: media.uploadedAt,
  };
}

async function requireEligibleCreator(user) {
  if (
    !user ||
    user.role !== "CREATOR" ||
    user.status !== "ACTIVE"
  ) {
    throw createError(
      "An active creator account is required.",
      403,
    );
  }

  if (!user.ageVerifiedAt) {
    throw createError(
      "Age verification is required before uploading content.",
      403,
    );
  }

  const profile = await CreatorProfile.findOne({
    userId: user._id,
    applicationStatus: "APPROVED",
  });

  if (!profile) {
    throw createError(
      "Your creator application must be approved before uploading content.",
      403,
    );
  }

  return profile;
}

export async function createVideoUpload({
  user,
  payload,
}) {
  const profile = await requireEligibleCreator(user);

  if (
    !Number.isInteger(payload.sizeBytes) ||
    payload.sizeBytes < 1 ||
    payload.sizeBytes > MAX_VIDEO_SIZE
  ) {
    throw createError(
      "Video size must be between 1 byte and 200 MB.",
    );
  }

  const extension = getVideoExtension(payload.mimeType);

  const media = await Media.create({
    creatorId: user._id,
    creatorProfileId: profile._id,

    title: payload.title,
    description: payload.description || "",

    mimeType: payload.mimeType,
    sizeBytes: payload.sizeBytes,

    storageKey: [
      "creators",
      String(user._id),
      "videos",
      `${randomUUID()}.${extension}`,
    ].join("/"),

    status: MEDIA_STATUSES.UPLOADING,

    uploadExpiresAt: new Date(
      Date.now() + UPLOAD_URL_LIFETIME_MS,
    ),
  });

  try {
    const upload = await createVideoUploadUrl({
      storageKey: media.storageKey,
      mimeType: media.mimeType,
      creatorId: user._id,
      mediaId: media._id,
    });

    return {
      media: formatMedia(media),
      uploadUrl: upload.uploadUrl,
      requiredHeaders: upload.requiredHeaders,
      expiresInSeconds: 600,
    };
  } catch (error) {
    await Media.findByIdAndDelete(media._id);
    throw error;
  }
}

export async function completeVideoUpload({
  userId,
  mediaId,
}) {
  const media = await Media.findOne({
    _id: mediaId,
    creatorId: userId,
  }).select("+storageKey");

  if (!media) {
    throw createError(
      "Video upload record was not found.",
      404,
    );
  }

  // Make completion requests safely repeatable.
  if (media.status === MEDIA_STATUSES.PROCESSING) {
    return formatMedia(media);
  }

  if (media.status !== MEDIA_STATUSES.UPLOADING) {
    throw createError(
      "This video is not awaiting upload completion.",
      409,
    );
  }

  if (media.uploadExpiresAt.getTime() < Date.now()) {
    await Media.updateOne(
      {
        _id: media._id,
        status: MEDIA_STATUSES.UPLOADING,
      },
      {
        $set: {
          status: MEDIA_STATUSES.FAILED,
        },
      },
    );

    throw createError(
      "The upload session has expired. Please start a new upload.",
      410,
    );
  }

  let object;

  try {
    object = await getPrivateObjectMetadata(media.storageKey);
  } catch (error) {
    if (
      error.name === "NotFound" ||
      error.name === "NoSuchKey" ||
      error.$metadata?.httpStatusCode === 404
    ) {
      throw createError(
        "The video has not reached storage yet.",
        409,
      );
    }

    throw createError(
      "Unable to verify the uploaded video in storage.",
      502,
    );
  }

  const metadata = object.Metadata || {};

  const validObject =
    Number.isInteger(object.ContentLength) &&
    object.ContentLength > 0 &&
    object.ContentLength <= MAX_VIDEO_SIZE &&
    object.ContentLength === media.sizeBytes &&
    object.ContentType === media.mimeType &&
    metadata["owner-id"] === String(userId) &&
    metadata["media-id"] === String(media._id);

  if (!validObject) {
    throw createError(
      "The uploaded video does not match the expected upload details.",
      400,
    );
  }

  const updatedMedia = await Media.findOneAndUpdate(
    {
      _id: media._id,
      creatorId: userId,
      status: MEDIA_STATUSES.UPLOADING,
      uploadExpiresAt: { $gte: new Date() },
    },
    {
      $set: {
        status: MEDIA_STATUSES.PROCESSING,
        uploadedAt: new Date(),
        processingStartedAt: new Date(),
      },
    },
    {
      new: true,
    },
  );

  if (updatedMedia) {
    return formatMedia(updatedMedia);
  }

  const latestMedia = await Media.findOne({
    _id: media._id,
    creatorId: userId,
  });

  if (latestMedia?.status === MEDIA_STATUSES.PROCESSING) {
    return formatMedia(latestMedia);
  }

  throw createError(
    "The upload could not be completed. Please try again.",
    409,
  );
}
