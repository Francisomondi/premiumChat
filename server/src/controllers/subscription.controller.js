
import {
  reserveCreatorSubscription,
} from "../services/subscription.service.js";

export async function createSubscriptionRequest(req, res, next) {
  try {
    const { creatorProfileId, clientRequestId } = req.body ?? {};

    const result = await reserveCreatorSubscription({
      fan: req.user,
      creatorProfileId,
      clientRequestId,
    });

    return res.status(result.reused ? 200 : 201).json({
      success: true,
      message: result.reused
        ? "Existing subscription reservation retrieved."
        : "Subscription reservation created. Payment is required to activate it.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}
