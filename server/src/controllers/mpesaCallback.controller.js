
import { ingestMpesaStkCallback } from "../services/mpesaCallback.service.js";

export async function receiveMpesaStkCallback(req, res) {
  try {
    const result = await ingestMpesaStkCallback(req.body);

    // Acknowledge receipt only. This does not verify payment.
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Callback received successfully.",
      accepted: result.accepted,
      duplicate: result.duplicate,
      paymentMatched: result.paymentMatched,
      eventId: result.eventId,
      status: result.status,
    });
  } catch (error) {
    // Log operational details without exposing internal errors.
    console.error("M-Pesa callback ingestion failed:", {
      message: error.message,
      code: error.code,
    });

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Callback received for processing.",
    });
  }
}
