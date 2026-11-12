
import {
  registerUser,
  loginUser,
  formatUser,
  revokeSession,
  getSessionCookieName,
  getSessionCookieOptions,
} from "../services/auth.service.js";

import {
  registerSchema,
  loginSchema,
} from "../validators/auth.validator.js";

function validatePasswordBytes(password) {
  return Buffer.byteLength(password, "utf8") <= 72;
}

export async function register(req, res, next) {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Please check your registration details.",
        errors: result.error.flatten().fieldErrors,
      });
    }

    if (!validatePasswordBytes(result.data.password)) {
      return res.status(400).json({
        success: false,
        message: "Password is too long.",
      });
    }

    const { user, token } = await registerUser({
      ...result.data,
      request: req,
    });

    res.cookie(
      getSessionCookieName(),
      token,
      getSessionCookieOptions(),
    );

    return res.status(201).json({
      success: true,
      message: "Your account has been created successfully.",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Please check your login details.",
        errors: result.error.flatten().fieldErrors,
      });
    }

    if (!validatePasswordBytes(result.data.password)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const { user, token } = await loginUser({
      ...result.data,
      request: req,
    });

    res.cookie(
      getSessionCookieName(),
      token,
      getSessionCookieOptions(),
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: formatUser(req.user),
    },
  });
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.[getSessionCookieName()];

    await revokeSession(token);

    res.clearCookie(getSessionCookieName(), {
      httpOnly: true,
      secure: getSessionCookieOptions().secure,
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "You have been logged out.",
    });
  } catch (error) {
    return next(error);
  }
}
