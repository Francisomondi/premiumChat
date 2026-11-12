import crypto from "node:crypto";

import User, {
  USER_ROLES,
  USER_STATUSES,
} from "../models/User.model.js";

import Session from "../models/Session.model.js";
import { env } from "../config/env.js";

const SESSION_COOKIE_NAME = "pc_session";

const SESSION_DURATION_MS =
  env.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function calculateAge(dateOfBirth) {
  const today = new Date();

  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();

  const birthYear = dateOfBirth.getUTCFullYear();
  const birthMonth = dateOfBirth.getUTCMonth() + 1;
  const birthDay = dateOfBirth.getUTCDate();

  let age = todayYear - birthYear;

  if (
    todayMonth < birthMonth ||
    (todayMonth === birthMonth && todayDay < birthDay)
  ) {
    age -= 1;
  }

  return age;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function formatUser(user) {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    ageVerified: Boolean(user.ageVerifiedAt),
    ageVerifiedAt: user.ageVerifiedAt || null,
    createdAt: user.createdAt,
  };
}

export async function registerUser({
  displayName,
  email,
  password,
  role,
  request,
}) {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    const error = new Error("An account with this email already exists.");
    error.status = 409;
    throw error;
  }

  const user = await User.create({
    displayName: displayName.trim(),
    email: normalizedEmail,
    passwordHash: password,
    role: role || USER_ROLES.FAN,
    status: USER_STATUSES.ACTIVE,
  });

  const session = await createUserSession(user, request);

  return {
    user: formatUser(user),
    token: session.token,
  };
}

export async function loginUser({ email, password, request }) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+passwordHash");

  if (!user) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }

  const passwordMatches = await user.comparePassword(password);

  if (!passwordMatches) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    const error = new Error("This account is currently unavailable.");
    error.status = 403;
    throw error;
  }

  user.lastLoginAt = new Date();
  await user.save();

  const session = await createUserSession(user, request);

  return {
    user: formatUser(user),
    token: session.token,
  };
}

export async function verifyUserAge(userId, dateOfBirth) {
  const user = await User.findById(userId);

  if (!user || user.status !== USER_STATUSES.ACTIVE) {
    const error = new Error("Your account could not be verified.");
    error.status = 404;
    throw error;
  }

  if (user.ageVerifiedAt) {
    const error = new Error("Your age has already been verified.");
    error.status = 409;
    throw error;
  }

  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);

  if (calculateAge(birthDate) < 18) {
    const error = new Error(
      "You must be at least 18 years old to use this platform.",
    );

    error.status = 403;
    throw error;
  }

  user.dateOfBirth = birthDate;
  user.ageVerifiedAt = new Date();

  await user.save();

  return formatUser(user);
}

async function createUserSession(user, request) {
  const token = createSessionToken();

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_MS,
  );

  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: request.get("user-agent")?.slice(0, 500) || null,
    ipAddress: request.ip || null,
  });

  return {
    token,
    expiresAt,
  };
}

export async function getAuthenticatedSession(token) {
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  const session = await Session.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");

  if (!session) {
    return null;
  }

  const user = await User.findById(session.userId);

  if (!user || user.status !== USER_STATUSES.ACTIVE) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }

  return {
    user,
    session,
  };
}

export async function revokeSession(token) {
  if (!token) {
    return;
  }

  await Session.deleteOne({
    tokenHash: hashToken(token),
  });
}

export async function revokeAllUserSessions(userId) {
  await Session.deleteMany({ userId });
}