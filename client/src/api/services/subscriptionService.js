
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

export async function getMySubscriptions({
  page = 1,
  limit = 20,
  status,
} = {}) {
  const response = await axiosInstance.get("/subscriptions/mine", {
    params: { page, limit, ...(status ? { status } : {}) },
  });

  return response.data;
}

export async function getMySubscription(subscriptionId) {
  const response = await axiosInstance.get(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );

  return response.data;
}

export async function getMySubscriptionPayments(
  subscriptionId,
  { page = 1, limit = 10 } = {},
) {
  const response = await axiosInstance.get(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`,
    { params: { page, limit } },
  );

  return response.data;
}

export async function cancelMySubscription(subscriptionId) {
  const response = await axiosInstance.patch(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
  );

  return response.data;
}
