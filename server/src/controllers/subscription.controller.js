
import {
  reserveCreatorSubscription,
  getMySubscriptions,
  getMySubscriptionById,
  getMySubscriptionPayments,
  cancelMySubscription,
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

export async function getMySubscriptionsRequest(req, res, next) {
  try {
    const result = await getMySubscriptions({
      fan: req.user,
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMySubscriptionRequest(req, res, next) {
  try {
    const result = await getMySubscriptionById({
      fan: req.user,
      subscriptionId: req.params.subscriptionId,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMySubscriptionPaymentsRequest(req, res, next) {
  try {
    const result = await getMySubscriptionPayments({
      fan: req.user,
      subscriptionId: req.params.subscriptionId,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function cancelMySubscriptionRequest(req, res, next) {
  try {
    const result = await cancelMySubscription({
      fan: req.user,
      subscriptionId: req.params.subscriptionId,
    });

    return res.status(200).json({
      success: true,
      message: "Pending subscription reservation cancelled.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}
