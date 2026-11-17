
import axiosInstance from "../axiosInstance";

export async function getPublicVideoFeed({
  page = 1,
  limit = 12,
} = {}) {
  const response = await axiosInstance.get(
    "/public/videos/feed",
    {
      params: { page, limit },
    },
  );

  return response.data;
}

export async function getPublicCreatorVideos(
  username,
  {
    page = 1,
    limit = 12,
  } = {},
) {
  const response = await axiosInstance.get(
    `/public/videos/creators/${encodeURIComponent(username)}`,
    {
      params: { page, limit },
    },
  );

  return response.data;
}

export async function getPublicVideoPlayback(mediaId) {
  const response = await axiosInstance.get(
    `/public/videos/${encodeURIComponent(mediaId)}/playback`,
  );

  return response.data;
}
