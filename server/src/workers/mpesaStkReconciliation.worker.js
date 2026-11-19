
import MpesaCallbackEvent, {
  MPESA_CALLBACK_STATUSES,
} from "../models/MpesaCallbackEvent.model.js";

import CreatorSubscription from "../models/CreatorSubscription.model.js";
import MediaPurchase from "../models/MediaPurchase.model.js";

import PaymentTransaction, {
  PAYMENT_STATUSES,
} from "../models/PaymentTransaction.model.js";

import {
  verifyMpesaCallbackEvent,
} from "../services/paymentVerification.service.js";

import {
  settleVerifiedPayment,
} from "../services/paymentSettlement.service.js";

const WORKER_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.MPESA_STK_WORKER_INTERVAL_MS) || 15000,
);

const MAX_PROCESSING_ATTEMPTS = Math.max(
  1,
  Number(process.env.MPESA_STK_WORKER_MAX_ATTEMPTS) || 12,
);

const STALE_PROCESSING_MS = 5 * 60 * 1000;
const UNMATCHED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const CALLBACK_BATCH_SIZE = 20;
const SETTLEMENT_BATCH_SIZE = 50;

let workerInterval = null;
let cycleRunning = false;

function logWorkerError(message, error) {
  console.error(message, {
    message: error?.message || "Unknown error",
    code: error?.code || null,
  });
}

function legacyProcessingFilter(staleBefore) {
  return {
    processingLeaseExpiresAt: null,
    updatedAt: { $lte: staleBefore },
  };
}

async function markEventForManualReview(event, reason) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

  const callback = await MpesaCallbackEvent.findOneAndUpdate(
    {
      _id: event._id,
      $or: [
        {
          status: MPESA_CALLBACK_STATUSES.RECEIVED,
        },
        {
          status: MPESA_CALLBACK_STATUSES.UNMATCHED,
        },
        {
          status: MPESA_CALLBACK_STATUSES.PROCESSING,
          processingLeaseExpiresAt: { $lte: now },
        },
        {
          status: MPESA_CALLBACK_STATUSES.PROCESSING,
          ...legacyProcessingFilter(staleBefore),
        },
      ],
    },
    {
      $set: {
        status: MPESA_CALLBACK_STATUSES.MANUAL_REVIEW,
        lastError: reason,
        processedAt: now,
        processingLeaseOwner: null,
        processingLeaseExpiresAt: null,
      },
    },
    {
      new: true,
    },
  );

  // Do not change payment state unless this worker successfully
  // moved the corresponding callback into manual review.
  if (!callback) {
    return false;
  }

  if (callback.paymentTransactionId) {
    await PaymentTransaction.findOneAndUpdate(
      {
        _id: callback.paymentTransactionId,
        status: {
          $in: [
            PAYMENT_STATUSES.PROCESSING,
            PAYMENT_STATUSES.UNKNOWN,
            PAYMENT_STATUSES.REQUIRES_RECONCILIATION,
          ],
        },
      },
      {
        $set: {
          status: PAYMENT_STATUSES.REQUIRES_RECONCILIATION,
          reconciliationRequiredAt: now,
        },
      },
    );
  }

  return true;
}

async function recoverStaleProcessingEvents() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

  const recoverableFilter = {
    status: MPESA_CALLBACK_STATUSES.PROCESSING,
    processingAttempts: { $lt: MAX_PROCESSING_ATTEMPTS },
    $or: [
      {
        processingLeaseExpiresAt: { $lte: now },
      },
      legacyProcessingFilter(staleBefore),
    ],
  };

  const result = await MpesaCallbackEvent.updateMany(
    recoverableFilter,
    {
      $set: {
        status: MPESA_CALLBACK_STATUSES.RECEIVED,
        lastError: "Recovered after an expired or interrupted verification lease.",
        processingLeaseOwner: null,
        processingLeaseExpiresAt: null,
      },
    },
  );

  if (result.modifiedCount > 0) {
    console.log(
      `Recovered ${result.modifiedCount} expired M-Pesa callback lease(s).`,
    );
  }

  const exhausted = await MpesaCallbackEvent.find({
    status: MPESA_CALLBACK_STATUSES.PROCESSING,
    processingAttempts: { $gte: MAX_PROCESSING_ATTEMPTS },
    $or: [
      {
        processingLeaseExpiresAt: { $lte: now },
      },
      legacyProcessingFilter(staleBefore),
    ],
  })
    .select("_id paymentTransactionId")
    .limit(CALLBACK_BATCH_SIZE);

  for (const event of exhausted) {
    const moved = await markEventForManualReview(
      event,
      "Maximum callback processing attempts exceeded after interrupted processing.",
    );

    if (moved) {
      console.warn(
        `M-Pesa callback ${event._id} moved to manual review after exhausting processing attempts.`,
      );
    }
  }
}

async function matchUnmatchedCallbacks() {
  const events = await MpesaCallbackEvent.find({
    status: MPESA_CALLBACK_STATUSES.UNMATCHED,
    paymentTransactionId: null,
    checkoutRequestId: { $type: "string" },
  })
    .sort({ createdAt: 1 })
    .limit(CALLBACK_BATCH_SIZE)
    .select("_id checkoutRequestId createdAt");

  for (const event of events) {
    const payment = await PaymentTransaction.findOne({
      checkoutRequestId: event.checkoutRequestId,
    }).select("_id");

    if (payment) {
      const matched = await MpesaCallbackEvent.findOneAndUpdate(
        {
          _id: event._id,
          status: MPESA_CALLBACK_STATUSES.UNMATCHED,
          paymentTransactionId: null,
        },
        {
          $set: {
            paymentTransactionId: payment._id,
            status: MPESA_CALLBACK_STATUSES.RECEIVED,
            lastError: null,
            processingLeaseOwner: null,
            processingLeaseExpiresAt: null,
          },
        },
        { new: true },
      );

      if (matched) {
        console.log(
          `Matched M-Pesa callback ${event._id} to payment ${payment._id}.`,
        );
      }

      continue;
    }

    const age = Date.now() - new Date(event.createdAt).getTime();

    if (age >= UNMATCHED_MAX_AGE_MS) {
      const moved = await markEventForManualReview(
        event,
        "Callback could not be matched to a payment after 24 hours.",
      );

      if (moved) {
        console.warn(
          `Unmatched M-Pesa callback ${event._id} moved to manual review.`,
        );
      }
    }
  }
}

async function processReceivedCallbacks() {
  const events = await MpesaCallbackEvent.find({
    status: MPESA_CALLBACK_STATUSES.RECEIVED,
    paymentTransactionId: { $ne: null },
  })
    .sort({ createdAt: 1 })
    .limit(CALLBACK_BATCH_SIZE)
    .select("_id paymentTransactionId processingAttempts");

  for (const event of events) {
    if (event.processingAttempts >= MAX_PROCESSING_ATTEMPTS) {
      const moved = await markEventForManualReview(
        event,
        "Maximum M-Pesa callback verification attempts exceeded.",
      );

      if (moved) {
        console.warn(
          `M-Pesa callback ${event._id} moved to manual review after reaching the retry limit.`,
        );
      }

      continue;
    }

    try {
      const result = await verifyMpesaCallbackEvent({
        callbackEventId: event._id,
      });

      if (!result.verified) {
        if (result.retryable) {
          console.log(
            `M-Pesa callback ${event._id} will be retried: ${result.reason}`,
          );
        } else if (result.manualReview) {
          console.warn(
            `M-Pesa callback ${event._id} requires manual review: ${result.reason}`,
          );
        }

        continue;
      }

      console.log(
        `M-Pesa payment ${result.paymentId} financially verified.`,
      );

      try {
        const settlement = await settleVerifiedPayment({
          paymentId: result.paymentId,
        });

        console.log("M-Pesa payment settled:", {
          paymentId: result.paymentId,
          purpose: settlement.purpose,
          duplicate: settlement.duplicate,
        });
      } catch (error) {
        logWorkerError(
          `Settlement failed for verified payment ${result.paymentId}.`,
          error,
        );
      }
    } catch (error) {
      logWorkerError(
        `Failed to process M-Pesa callback ${event._id}.`,
        error,
      );
    }
  }
}

async function recoverVerifiedPayments() {
  const pendingSubscriptions = await CreatorSubscription.find({
    status: "PENDING",
    lastPaymentId: { $ne: null },
  })
    .sort({ updatedAt: 1 })
    .limit(SETTLEMENT_BATCH_SIZE)
    .select("lastPaymentId");

  const pendingMediaPurchases = await MediaPurchase.find({
    status: "PENDING",
    lastPaymentId: { $ne: null },
  })
    .sort({ updatedAt: 1 })
    .limit(SETTLEMENT_BATCH_SIZE)
    .select("lastPaymentId");

  const paymentIds = [
    ...pendingSubscriptions.map((item) => item.lastPaymentId),
    ...pendingMediaPurchases.map((item) => item.lastPaymentId),
  ].filter(Boolean);

  if (!paymentIds.length) {
    return;
  }

  const payments = await PaymentTransaction.find({
    _id: { $in: paymentIds },
    status: PAYMENT_STATUSES.SUCCEEDED,
  }).select("_id");

  for (const payment of payments) {
    try {
      const result = await settleVerifiedPayment({
        paymentId: payment._id,
      });

      if (!result.duplicate) {
        console.log(
          `Recovered settlement for payment ${payment._id}.`,
        );
      }
    } catch (error) {
      logWorkerError(
        `Unable to recover settlement for payment ${payment._id}.`,
        error,
      );
    }
  }
}

export async function runMpesaStkReconciliationCycle() {
  if (cycleRunning) {
    return {
      skipped: true,
      reason: "A reconciliation cycle is already running.",
    };
  }

  cycleRunning = true;

  try {
    await recoverStaleProcessingEvents();
    await matchUnmatchedCallbacks();
    await processReceivedCallbacks();
    await recoverVerifiedPayments();

    return {
      skipped: false,
      completed: true,
    };
  } catch (error) {
    logWorkerError(
      "M-Pesa reconciliation cycle failed.",
      error,
    );

    return {
      skipped: false,
      completed: false,
      error: error.message,
    };
  } finally {
    cycleRunning = false;
  }
}

export function startMpesaStkReconciliationWorker() {
  if (workerInterval) {
    console.log("M-Pesa reconciliation worker is already running.");
    return;
  }

  console.log(
    `M-Pesa reconciliation worker started. Interval: ${WORKER_INTERVAL_MS}ms`,
  );

  void runMpesaStkReconciliationCycle();

  workerInterval = setInterval(() => {
    void runMpesaStkReconciliationCycle();
  }, WORKER_INTERVAL_MS);

  workerInterval.unref?.();
}

export function stopMpesaStkReconciliationWorker() {
  if (!workerInterval) {
    return;
  }

  clearInterval(workerInterval);
  workerInterval = null;

  console.log("M-Pesa reconciliation worker stopped.");
}
