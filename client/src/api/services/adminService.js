
import axiosInstance from "../axiosInstance";

export async function getCreatorApplications(params = {}) {
  const response = await axiosInstance.get(
    "/creators/admin/applications",
    { params },
  );

  return response.data;
}

export async function reviewCreatorApplication(applicationId, payload) {
  const response = await axiosInstance.patch(
    `/creators/admin/applications/${applicationId}/review`,
    payload,
  );

  return response.data;
}
