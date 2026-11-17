import mongoose from "mongoose";

import Media, {
  MEDIA_STATUSES,
  MEDIA_TYPES,
} from "../models/Media.model.js";

import CreatorProfile, {
  CREATOR_APPLICATION_STATUSES,
} from "../models/CreatorProfile.model.js";

import { USER_ROLES, USER_STATUSES } from "../models/User.model.js";

import { createPrivateReadUrl } from "./storage.service.js";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 30;
const PLAYBACK_URL_TTL_SECONDS = 180;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parsePagination(page, limit) {
  const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const parsedLimit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(limit, 10) || DEFAULT_PAGE_SIZE),
  );

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
}

function formatCreator(profile) {
  const user = profile.userId;

  return {
    id: String(profile._id),
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    country: profile.country,
   
  };
}

function formatPublicMedia(media, creator, thumbnailUrl = null) {
  return {
    id: String(media._id),
    title: media.title,
    description: media.description,
    mediaType: media.mediaType,
    mimeType: "video/mp4",
    accessPolicy: media.accessPolicy,
    priceKes: media.priceKes,
    durationSeconds: media.durationSeconds,
    width: media.width,
    height: media.height,
    thumbnailUrl,
    publishedAt: media.publishedAt,
    createdAt: media.createdAt,
    creator: formatCreator(creator),
  };
}

async function getEligibleCreatorProfiles() {
  const profiles = await CreatorProfile.find({
    applicationStatus: CREATOR_APPLICATION_STATUSES.APPROVED,
  })
    .populate({
      path: "userId",
      select: "displayName role status ageVerifiedAt",
      match: {
        role: USER_ROLES.CREATOR,
        status: USER_STATUSES.ACTIVE,
        ageVerifiedAt: { $ne: null },
      },
    })
    .lean();

  return profiles.filter((profile) => profile.userId);
}

async function signThumbnail(media) {
  if (!media.thumbnailStorageKey) {
    return null;
  }

  return createPrivateReadUrl({
    storageKey: media.thumbnailStorageKey,
    expiresIn: PLAYBACK_URL_TTL_SECONDS,
    contentType: "image/jpeg",
  });
}

function assertEligibleFan(user) {
  if (!user || user.role !== USER_ROLES.FAN) {
    throw createHttpError(
      403,
      "Only fan accounts can access public video discovery.",
    );
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw createHttpError(403, "Your account is not active.");
  }

  if (!user.ageVerifiedAt) {
    throw createHttpError(
      403,
      "Please verify your age before watching videos.",
    );
  }
}

function assertFreePlayback(media) {
  if (media.accessPolicy === "SUBSCRIBERS_ONLY") {
    throw createHttpError(
      403,
      "This video is available to subscribers only.",
    );
  }

  if (media.accessPolicy === "PURCHASE_ONLY") {
    throw createHttpError(
      403,
      "This video requires a purchase before it can be watched.",
    );
  }

  if (media.accessPolicy !== "FREE") {
    throw createHttpError(
      403,
      "This video's access policy does not allow playback.",
    );
  }
}

const publishedVideoFilter = {
  mediaType: MEDIA_TYPES.VIDEO,
  status: MEDIA_STATUSES.READY,
  moderationStatus: "APPROVED",
  publicationStatus: "PUBLISHED",
};

export async function getPublicVideoFeed({
  user,
  page,
  limit,
}) {
  assertEligibleFan(user);

  const pagination = parsePagination(page, limit);
  const creators = await getEligibleCreatorProfiles();

  if (!creators.length) {
    return {
      videos: [],
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const creatorById = new Map(
    creators.map((creator) => [String(creator._id), creator]),
  );

  const creatorProfileIds = creators.map((creator) => creator._id);

  const filter = {
    ...publishedVideoFilter,
    creatorProfileId: { $in: creatorProfileIds },
  };

  const [mediaItems, total] = await Promise.all([
    Media.find(filter)
      .select("+thumbnailStorageKey")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),

    Media.countDocuments(filter),
  ]);

  const videos = await Promise.all(
    mediaItems.map(async (media) => {
      const creator = creatorById.get(String(media.creatorProfileId));

      if (!creator) {
        return null;
      }

      const thumbnailUrl = await signThumbnail(media);

      return formatPublicMedia(media, creator, thumbnailUrl);
    }),
  );

  return {
    videos: videos.filter(Boolean),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function getPublicCreatorVideos({
  user,
  username,
  page,
  limit,
}) {
  assertEligibleFan(user);

  const normalizedUsername = String(username || "")
    .trim()
    .toLowerCase();

  if (!normalizedUsername) {
    throw createHttpError(400, "A creator username is required.");
  }

  const creator = await CreatorProfile.findOne({
    username: normalizedUsername,
    applicationStatus: CREATOR_APPLICATION_STATUSES.APPROVED,
  }).populate({
    path: "userId",
    select: "displayName role status ageVerifiedAt",
    match: {
      role: USER_ROLES.CREATOR,
      status: USER_STATUSES.ACTIVE,
      ageVerifiedAt: { $ne: null },
    },
  });

  if (!creator || !creator.userId) {
    throw createHttpError(404, "Creator profile not found.");
  }

  const pagination = parsePagination(page, limit);

  const filter = {
    ...publishedVideoFilter,
    creatorId: creator.userId._id,
    creatorProfileId: creator._id,
  };

  const [mediaItems, total] = await Promise.all([
    Media.find(filter)
      .select("+thumbnailStorageKey")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),

    Media.countDocuments(filter),
  ]);

  const videos = await Promise.all(
    mediaItems.map(async (media) => {
      const thumbnailUrl = await signThumbnail(media);

      return formatPublicMedia(media, creator, thumbnailUrl);
    }),
  );

  return {
    creator: formatCreator(creator),
    videos,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function getPublicVideoPlayback({
  user,
  mediaId,
}) {
  assertEligibleFan(user);

  if (!mongoose.isValidObjectId(mediaId)) {
    throw createHttpError(400, "Invalid video ID.");
  }

  const media = await Media.findOne({
    _id: mediaId,
    ...publishedVideoFilter,
  }).select("+processedStorageKey");

  if (!media) {
    throw createHttpError(404, "This video is not available.");
  }

  const creator = await CreatorProfile.findOne({
    _id: media.creatorProfileId,
    userId: media.creatorId,
    applicationStatus: CREATOR_APPLICATION_STATUSES.APPROVED,
  }).populate({
    path: "userId",
    select: "displayName role status ageVerifiedAt",
    match: {
      role: USER_ROLES.CREATOR,
      status: USER_STATUSES.ACTIVE,
      ageVerifiedAt: { $ne: null },
    },
  });

  if (!creator || !creator.userId) {
    throw createHttpError(404, "This video is no longer available.");
  }

  assertFreePlayback(media);

  if (!media.processedStorageKey) {
    throw createHttpError(
      409,
      "This video is not ready for playback yet.",
    );
  }

  const playbackUrl = await createPrivateReadUrl({
    storageKey: media.processedStorageKey,
    expiresIn: PLAYBACK_URL_TTL_SECONDS,
    contentType: "video/mp4",
  });

  return {
    video: {
      id: String(media._id),
      title: media.title,
      description: media.description,
      durationSeconds: media.durationSeconds,
      accessPolicy: media.accessPolicy,
      playbackUrl,
      expiresIn: PLAYBACK_URL_TTL_SECONDS,
      creator: formatCreator(creator),
    },
  };
}