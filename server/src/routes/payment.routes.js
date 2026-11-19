
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  initiateSubscriptionPaymentRequest,
  initiateMediaPurchasePaymentRequest,
} from "../controllers/payment.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";

const router = Router();

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many payment attempts. Please try again later.",
  },
});

router.use(requireAuth, requireRole("FAN"));

router.post(
  "/subscriptions/:subscriptionId/initiate",
  requireTrustedOrigin,
  paymentLimiter,
  initiateSubscriptionPaymentRequest,
);

router.post(
  "/media-purchases/:mediaPurchaseId/initiate",
  requireTrustedOrigin,
  paymentLimiter,
  initiateMediaPurchasePaymentRequest,
);

export default router;
