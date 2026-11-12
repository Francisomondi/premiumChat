import axiosInstance from "../axiosInstance";

export async function registerUser(payload) {
  const response = await axiosInstance.post("/auth/register", payload);
  return response.data;
}

export async function loginUser(payload) {
  const response = await axiosInstance.post("/auth/login", payload);
  return response.data;
}

export async function getCurrentUser() {
  const response = await axiosInstance.get("/auth/me");
  return response.data;
}

export async function verifyUserAge(payload) {
  const response = await axiosInstance.post(
    "/auth/verify-age",
    payload,
  );

  return response.data;
}

export async function logoutUser() {
  const response = await axiosInstance.post("/auth/logout");
  return response.data;
}