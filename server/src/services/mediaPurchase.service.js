
import mongoose from "mongoose";

import CreatorProfile, {
  CREATOR_APPLICATION_STATUSES,
} from "../models/CreatorProfile.model.js";

import Media, {
  MEDIA_STATUSES,
  MEDIA_MODERATION_STATUSES,
  MEDIA_PUBLICATION_STATUSES,
  MEDIA_ACCESS_POLICIES,
  MEDIA_TYPES,
} from "../models/Media.model.js";

import MediaPurchase, {
  MEDIA_PURCHASE_STATUSES,
} from "../models/MediaPurchase.model.js";

import {
  USER_ROLES,
  USER_STATUSES,
} from "../models/User.model.js";

const PENDING_RESERVATION_WINDOW_MS = 15 * 60 * 1000;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateClientRequestId(clientRequestId) {
  if (
    typeof clientRequestId !== "string" ||
    clientRequestId.trim().length < 16 ||
    clientRequestId.trim().length > 100
  ) {
    throw createHttpError(
      400,
      "clientRequestId must contain between 16 and 100 characters.",
    );
  }

  return clientRequestId.trim();
}

function formatReservation(reservation) {
  return {
    id: reservation._id.toString(),
    mediaId: reservation.mediaId.toString(),
    creatorId: reservation.creatorId.toString(),
    amountKes: reservation.amountKes,
    currency: reservation.currency,
    status: reservation.status,
    purchasedAt: reservation.purchasedAt,
    createdAt: reservation.createdAt,
  };
}

export async function reserveMediaPurchase({
  fan,
  mediaId,
  clientRequestId,
}) {
  if (
    !fan ||
    fan.role !== USER_ROLES.FAN ||
    fan.status !== USER_STATUSES.ACTIVE ||
    !fan.ageVerifiedAt
  ) {
    throw createHttpError(
      403,
      "An active, age-verified fan account is required.",
    );
  }

  if (!mongoose.isValidObjectId(mediaId)) {
    throw createHttpError(400, "Invalid media ID.");
  }

  const requestId = validateClientRequestId(clientRequestId);

  const existingRequest = await MediaPurchase.findOne({
    fanId: fan._id,
    clientRequestId: requestId,
  });

  if (existingRequest) {
    if (existingRequest.mediaId.toString() !== mediaId) {
      throw createHttpError(
        409,
        "This request ID has already been used for another video purchase.",
      );
    }

    return {
      reservation: formatReservation(existingRequest),
      reused: true,
    };
  }

  const media = await Media.findOne({
    _id: mediaId,
    mediaType: MEDIA_TYPES.VIDEO,
    status: MEDIA_STATUSES.READY,
    moderationStatus: MEDIA_MODERATION_STATUSES.APPROVED,
    publicationStatus: MEDIA_PUBLICATION_STATUSES.PUBLISHED,
    accessPolicy: MEDIA_ACCESS_POLICIES.PURCHASE_ONLY,
  }).select("creatorId creatorProfileId accessPolicy priceKes");

  if (!media) {
    throw createHttpError(
      404,
      "This paid video is unavailable for purchase.",
    );
  }

  if (media.creatorId.toString() === fan._id.toString()) {
    throw createHttpError(
      403,
      "You cannot purchase your own video.",
    );
  }

  const creatorProfile = await CreatorProfile.findOne({
    _id: media.creatorProfileId,
    userId: media.creatorId,
    applicationStatus: CREATOR_APPLICATION_STATUSES.APPROVED,
  }).populate({
    path: "userId",
    select: "role status ageVerifiedAt",
  });

  if (
    !creatorProfile ||
    !creatorProfile.paidMediaEnabled ||
    !creatorProfile.userId ||
    creatorProfile.userId.role !== USER_ROLES.CREATOR ||
    creatorProfile.userId.status !== USER_STATUSES.ACTIVE ||
    !creatorProfile.userId.ageVerifiedAt
  ) {
    throw createHttpError(
      409,
      "This creator is not currently eligible to sell paid videos.",
    );
  }

  const amountKes = media.priceKes;

  if (!Number.isSafeInteger(amountKes) || amountKes < 1) {
    throw createHttpError(
      409,
      "This video does not have a valid purchase price.",
    );
  }

  const now = new Date();

  const activePurchase = await MediaPurchase.findOne({
    fanId: fan._id,
    mediaId: media._id,
    status: MEDIA_PURCHASE_STATUSES.ACTIVE,
  });

  if (activePurchase) {
    throw createHttpError(
      409,
      "You already have access to this video.",
    );
  }

  const recentPendingPurchase = await MediaPurchase.findOne({
    fanId: fan._id,
    mediaId: media._id,
    status: MEDIA_PURCHASE_STATUSES.PENDING,
    createdAt: {
      $gte: new Date(
        now.getTime() - PENDING_RESERVATION_WINDOW_MS,
      ),
    },
  });

  if (recentPendingPurchase) {
    throw createHttpError(
      409,
      "A purchase reservation for this video is already pending. Please complete or resolve that payment first.",
    );
  }

  try {
    const reservation = await MediaPurchase.create({
      fanId: fan._id,
      creatorId: media.creatorId,
      mediaId: media._id,
      amountKes,
      currency: "KES",
      status: MEDIA_PURCHASE_STATUSES.PENDING,
      clientRequestId: requestId,
    });

    return {
      reservation: formatReservation(reservation),
      reused: false,
    };
  } catch (error) {
    if (error.code === 11000) {
      const duplicateRequest = await MediaPurchase.findOne({
        fanId: fan._id,
        clientRequestId: requestId,
      });

      if (duplicateRequest) {
        if (duplicateRequest.mediaId.toString() !== mediaId) {
          throw createHttpError(
            409,
            "This request ID has already been used for another video purchase.",
          );
        }

        return {
          reservation: formatReservation(duplicateRequest),
          reused: true,
        };
      }

      throw createHttpError(
        409,
        "A purchase reservation with this request ID already exists.",
      );
    }

    throw error;
  }
}
