
import {
  getAuthenticatedSession,
  getSessionCookieName,
} from "../services/auth.service.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[getSessionCookieName()];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const authenticated = await getAuthenticatedSession(token);

    if (!authenticated) {
      return res.status(401).json({
        success: false,
        message: "Your session is invalid or has expired.",
      });
    }

    req.user = authenticated.user;
    req.session = authenticated.session;

    return next();
  } catch (error) {
    return next(error);
  }
}
