
import axiosInstance from "../axiosInstance";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

export async function createVideoUpload(payload) {
  const response = await axiosInstance.post(
    "/media/uploads",
    payload,
  );

  return response.data;
}

export async function uploadVideoToStorage({
  uploadUrl,
  file,
  requiredHeaders,
  onProgress,
}) {
  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error("Video cannot exceed 200 MB.");
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl);

    Object.entries(requiredHeaders).forEach(([name, value]) => {
      xhr.setRequestHeader(name, value);
    });

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(
          Math.round((event.loaded / event.total) * 100),
        );
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(
        new Error(
          `R2 upload failed with HTTP ${xhr.status}.`,
        ),
      );
    });

    xhr.addEventListener("error", () => {
      reject(
        new Error(
          "Could not connect to R2. Check your connection and bucket CORS settings.",
        ),
      );
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Video upload was cancelled."));
    });

    xhr.send(file);
  });
}

export async function completeVideoUpload(mediaId) {
  const response = await axiosInstance.post(
    `/media/${encodeURIComponent(mediaId)}/complete`,
  );

  return response.data;
}
