
import { getDatabaseStatus } from "../config/database.js";

export function getHealth(req, res) {
  const database = getDatabaseStatus();
  const healthy = database === "connected";

  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy
      ? "Premium Chat API is running."
      : "API is running but the database is unavailable.",
    data: {
      application: "Premium Chat",
      environment: process.env.NODE_ENV || "development",
      database,
      timestamp: new Date().toISOString(),
    },
  });
}
