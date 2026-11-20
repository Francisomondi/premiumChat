
import mongoose from "mongoose";

import PaymentTransaction from "../models/PaymentTransaction.model.js";

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

export async function getPaymentStatusRequest(req, res, next) {
  try {
    const { paymentId } = req.params;

    if (!mongoose.isValidObjectId(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    const payment = await PaymentTransaction.findOne({
      _id: paymentId,
      fanId: req.user._id,
    })
      .select(
        "purpose status initiationStatus verifiedAt resultDescription subscriptionId mediaPurchaseId",
      )
      .populate({
        path: "subscriptionId",
        select: "status expiresAt",
      })
      .populate({
        path: "mediaPurchaseId",
        select: "status purchasedAt",
      })
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment transaction not found.",
      });
    }

    const subscription = payment.subscriptionId || null;
    const mediaPurchase = payment.mediaPurchaseId || null;

    const subscriptionActive = Boolean(
      subscription &&
      subscription.status === "ACTIVE" &&
      subscription.expiresAt &&
      new Date(subscription.expiresAt) > new Date(),
    );

    const mediaPurchaseActive = Boolean(
      mediaPurchase &&
      mediaPurchase.status === "ACTIVE",
    );

    const paymentVerified = Boolean(
      payment.status === "SUCCEEDED" &&
      payment.verifiedAt,
    );

    return res.status(200).json({
      success: true,
      payment: {
        id: String(payment._id),
        purpose: payment.purpose,
        status: payment.status,
        initiationStatus: payment.initiationStatus,
        paymentVerified,
        message: payment.resultDescription || null,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            expiresAt: subscription.expiresAt,
            accessGranted: subscriptionActive,
          }
        : null,
      mediaPurchase: mediaPurchase
        ? {
            status: mediaPurchase.status,
            purchasedAt: mediaPurchase.purchasedAt,
            accessGranted: mediaPurchaseActive,
          }
        : null,
      accessGranted: subscriptionActive || mediaPurchaseActive,
    });
  } catch (error) {
    return next(error);
  }
}
