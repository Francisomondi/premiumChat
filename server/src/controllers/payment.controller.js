
import {
  initiateSubscriptionPayment,
  initiateMediaPurchasePayment,
} from "../services/paymentInitiation.service.js";

export async function initiateSubscriptionPaymentRequest(req, res, next) {
  try {
    const { phoneNumber } = req.body ?? {};

    const result = await initiateSubscriptionPayment({
      fan: req.user,
      subscriptionId: req.params.subscriptionId,
      phoneNumber,
    });

    return res.status(200).json({
      success: true,
      message: result.message ||
        "Subscription payment initiation processed.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function initiateMediaPurchasePaymentRequest(req, res, next) {
  try {
    const { phoneNumber } = req.body ?? {};

    const result = await initiateMediaPurchasePayment({
      fan: req.user,
      mediaPurchaseId: req.params.mediaPurchaseId,
      phoneNumber,
    });

    return res.status(200).json({
      success: true,
      message: result.message ||
        "Video purchase payment initiation processed.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}
