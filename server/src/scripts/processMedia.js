
import { connectDatabase } from "../config/database.js";
import {
  runMediaProcessingWorker,
  stopMediaProcessingWorker,
} from "../workers/mediaProcessing.worker.js";

async function start() {
  try {
    await connectDatabase();

    process.on("SIGINT", stopMediaProcessingWorker);
    process.on("SIGTERM", stopMediaProcessingWorker);

    await runMediaProcessingWorker();

    const mongoose = await import("mongoose");
    await mongoose.default.disconnect();

    process.exit(0);
  } catch (error) {
    console.error("Failed to start media processing worker:", error);

    const mongoose = await import("mongoose");

    try {
      await mongoose.default.disconnect();
    } catch {
      // Database may not have connected.
    }

    process.exit(1);
  }
}

start();
