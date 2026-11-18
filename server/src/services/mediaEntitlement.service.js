
import CreatorSubscription, {
  SUBSCRIPTION_STATUSES,
} from "../models/CreatorSubscription.model.js";

import MediaPurchase, {
  MEDIA_PURCHASE_STATUSES,
} from "../models/MediaPurchase.model.js";

export const MEDIA_ENTITLEMENT_REASONS = Object.freeze({
  FREE_ACCESS: "FREE_ACCESS",
  ACTIVE_SUBSCRIPTION: "ACTIVE_SUBSCRIPTION",
  ACTIVE_PURCHASE: "ACTIVE_PURCHASE",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  PURCHASE_REQUIRED: "PURCHASE_REQUIRED",
  ACCESS_POLICY_UNSUPPORTED: "ACCESS_POLICY_UNSUPPORTED",
});

export async function hasActiveCreatorSubscription({
  fanId,
  creatorId,
  now = new Date(),
}) {
  if (!fanId || !creatorId) {
    return false;
  }

  const subscription = await CreatorSubscription.exists({
    fanId,
    creatorId,
    status: SUBSCRIPTION_STATUSES.ACTIVE,
    expiresAt: { $gt: now },
  });

  return Boolean(subscription);
}

export async function hasActiveMediaPurchase({
  fanId,
  mediaId,
}) {
  if (!fanId || !mediaId) {
    return false;
  }

  const purchase = await MediaPurchase.exists({
    fanId,
    mediaId,
    status: MEDIA_PURCHASE_STATUSES.ACTIVE,
  });

  return Boolean(purchase);
}

export async function checkMediaPlaybackEntitlement({
  fanId,
  creatorId,
  mediaId,
  accessPolicy,
  now = new Date(),
}) {
  switch (accessPolicy) {
    case "FREE":
      return {
        allowed: true,
        reason: MEDIA_ENTITLEMENT_REASONS.FREE_ACCESS,
      };

    case "SUBSCRIBERS_ONLY": {
      const hasSubscription = await hasActiveCreatorSubscription({
        fanId,
        creatorId,
        now,
      });

      return {
        allowed: hasSubscription,
        reason: hasSubscription
          ? MEDIA_ENTITLEMENT_REASONS.ACTIVE_SUBSCRIPTION
          : MEDIA_ENTITLEMENT_REASONS.SUBSCRIPTION_REQUIRED,
      };
    }

    case "PURCHASE_ONLY": {
      const hasPurchase = await hasActiveMediaPurchase({
        fanId,
        mediaId,
      });

      return {
        allowed: hasPurchase,
        reason: hasPurchase
          ? MEDIA_ENTITLEMENT_REASONS.ACTIVE_PURCHASE
          : MEDIA_ENTITLEMENT_REASONS.PURCHASE_REQUIRED,
      };
    }

    default:
      return {
        allowed: false,
        reason: MEDIA_ENTITLEMENT_REASONS.ACCESS_POLICY_UNSUPPORTED,
      };
  }
}
