
import {
  createMediaWorkerId,
  processNextMedia,
} from "../services/mediaProcessing.service.js";

const POLL_INTERVAL_MS = 5000;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

let stopping = false;

export function stopMediaProcessingWorker() {
  stopping = true;
}

export async function runMediaProcessingWorker() {
  const workerId = createMediaWorkerId();

  console.log(`Media processing worker started: ${workerId}`);

  while (!stopping) {
    try {
      const processedJob = await processNextMedia(workerId);

      if (!processedJob && !stopping) {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error("Media worker cycle failed:", error);
      await sleep(POLL_INTERVAL_MS);
    }
  }

  console.log("Media processing worker stopped.");
}
