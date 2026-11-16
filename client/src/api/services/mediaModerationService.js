
import axiosInstance from "../axiosInstance";

export function getPendingMediaModeration() {
  return axiosInstance.get("/media/admin/moderation");
}

export function reviewMedia(mediaId, payload) {
  return axiosInstance.patch(
    `/media/admin/moderation/${mediaId}`,
    payload,
  );
}

export function getMediaModerationPreview(mediaId) {
  return axiosInstance.get(
    `/media/admin/moderation/${mediaId}/preview`,
  );
}
