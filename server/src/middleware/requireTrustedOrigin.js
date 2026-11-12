
import { env } from "../config/env.js";

const trustedOrigin = new URL(env.CLIENT_URL).origin;

export function requireTrustedOrigin(req, res, next) {
  const requestOrigin = req.get("origin");

  if (!requestOrigin || requestOrigin !== trustedOrigin) {
    return res.status(403).json({
      success: false,
      message: "Request origin is not allowed.",
    });
  }

  return next();
}
