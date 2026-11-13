import axiosInstance from "../axiosInstance";

export async function submitCreatorApplication(payload) {
  const response = await axiosInstance.post(
    "/creators/application",
    payload,
  );

  return response.data;
}

export async function getMyCreatorProfile() {
  const response = await axiosInstance.get("/creators/me");
  return response.data;
}

export async function updateMyCreatorProfile(payload) {
  const response = await axiosInstance.patch(
    "/creators/me",
    payload,
  );

  return response.data;
}

export async function getPublicCreators(params = {}) {
  const response = await axiosInstance.get("/creators", {
    params,
  });

  return response.data;
}

export async function getPublicCreatorProfile(username) {
  const response = await axiosInstance.get(
    `/creators/${encodeURIComponent(username)}`,
  );

  return response.data;
}