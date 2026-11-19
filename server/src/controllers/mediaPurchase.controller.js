
import {
  reserveMediaPurchase,
} from "../services/mediaPurchase.service.js";

export async function createMediaPurchaseRequest(req, res, next) {
  try {
    const { clientRequestId } = req.body ?? {};

    const result = await reserveMediaPurchase({
      fan: req.user,
      mediaId: req.params.mediaId,
      clientRequestId,
    });

    return res.status(result.reused ? 200 : 201).json({
      success: true,
      message: result.reused
        ? "Existing video purchase reservation retrieved."
        : "Video purchase reservation created. Payment is required to unlock this video.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

