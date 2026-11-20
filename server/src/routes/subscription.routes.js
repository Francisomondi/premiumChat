
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  createSubscriptionRequest,
  getMySubscriptionsRequest,
  getMySubscriptionRequest,
  getMySubscriptionPaymentsRequest,
  cancelMySubscriptionRequest,
} from "../controllers/subscription.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";

const router = Router();

const subscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many subscription attempts. Please try again later.",
  },
});

const subscriptionReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many subscription requests. Please try again later.",
  },
});

router.use(requireAuth, requireRole("FAN"));

router.get(
  "/mine",
  subscriptionReadLimiter,
  getMySubscriptionsRequest,
);

router.post(
  "/",
  requireTrustedOrigin,
  subscriptionLimiter,
  createSubscriptionRequest,
);

router.get(
  "/:subscriptionId/payments",
  subscriptionReadLimiter,
  getMySubscriptionPaymentsRequest,
);

router.get(
  "/:subscriptionId",
  subscriptionReadLimiter,
  getMySubscriptionRequest,
);

router.patch(
  "/:subscriptionId/cancel",
  requireTrustedOrigin,
  subscriptionLimiter,
  cancelMySubscriptionRequest,
);

export default router;
