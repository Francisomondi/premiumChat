
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

import {
  startMpesaStkReconciliationWorker,
  stopMpesaStkReconciliationWorker,
} from "./workers/mpesaStkReconciliation.worker.js";

async function startServer() {
  try {
    await connectDatabase();

    const server = app.listen(env.PORT, () => {
      console.log(
        `Premium Chat API running at http://localhost:${env.PORT}`,
      );

      startMpesaStkReconciliationWorker();
    });

    let shuttingDown = false;

    const shutdown = async (signal) => {
      if (shuttingDown) return;

      shuttingDown = true;
      console.log(`${signal} received. Shutting down...`);

      stopMpesaStkReconciliationWorker();

      try {
        if (server.listening) {
          await new Promise((resolve, reject) => {
            server.close((error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        }

        const mongoose = await import("mongoose");
        await mongoose.default.disconnect();

        console.log("MongoDB disconnected successfully.");
      } catch (error) {
        console.error("Graceful shutdown failed:", error);
        process.exitCode = 1;
      }
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start Premium Chat API:", error);
    process.exit(1);
  }
}

startServer();
