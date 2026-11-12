
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  register,
  login,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

router.post(
  "/register",
  requireTrustedOrigin,
  authLimiter,
  register,
);

router.post(
  "/login",
  requireTrustedOrigin,
  authLimiter,
  login,
);

router.get("/me", requireAuth, getCurrentUser);

router.post(
  "/logout",
  requireTrustedOrigin,
  requireAuth,
  logout,
);

export default router;
