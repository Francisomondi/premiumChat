
import axiosInstance from "../axiosInstance";

export async function createSubscriptionReservation({
  creatorProfileId,
  clientRequestId,
}) {
  const response = await axiosInstance.post("/subscriptions", {
    creatorProfileId,
    clientRequestId,
  });

  return response.data;
}

export async function initiateSubscriptionMpesaPayment({
  subscriptionId,
  phoneNumber,
}) {
  const response = await axiosInstance.post(
    `/payments/subscriptions/${encodeURIComponent(subscriptionId)}/initiate`,
    { phoneNumber },
  );

  return response.data;
}
export async function getPaymentStatus(paymentId) {
  const response = await axiosInstance.get(
    `/payments/${encodeURIComponent(paymentId)}/status`,
  );

  return response.data;
}

