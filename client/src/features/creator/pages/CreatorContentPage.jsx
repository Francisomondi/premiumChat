
import { useState } from "react";

import {
  createVideoUpload,
  uploadVideoToStorage,
  completeVideoUpload,
} from "../../../api/services/mediaService";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
];

export default function CreatorContentPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);

  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [pendingMediaId, setPendingMediaId] = useState(null);
  const [uploadedMedia, setUploadedMedia] = useState(null);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setError("");
    setMessage("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!ACCEPTED_VIDEO_TYPES.includes(selectedFile.type)) {
      setFile(null);
      setError("Please select an MP4 or WebM video.");
      return;
    }

    if (selectedFile.size > MAX_VIDEO_SIZE) {
      setFile(null);
      setError("Your video cannot exceed 200 MB.");
      return;
    }

    setFile(selectedFile);
  }

  async function verifyUploadedVideo(mediaId) {
    setError("");
    setMessage("Verifying your video upload...");

    try {
      const result = await completeVideoUpload(mediaId);

      setUploadedMedia(result.media);
      setPendingMediaId(null);
      setMessage(
        "Your video has been uploaded and queued for processing. It is not public yet.",
      );

      setTitle("");
      setDescription("");
      setFile(null);
      setProgress(100);
    } catch (uploadError) {
      setMessage("");
      setError(
        uploadError.response?.data?.message ||
          uploadError.message ||
          "Could not verify the uploaded video.",
      );
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setUploadedMedia(null);

    if (!title.trim()) {
      setError("Please enter a video title.");
      return;
    }

    if (!file) {
      setError("Please select a video to upload.");
      return;
    }

    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setError("Only MP4 and WebM videos are supported.");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      setError("Your video cannot exceed 200 MB.");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      setMessage("Preparing your secure upload...");

      const uploadSession = await createVideoUpload({
        title: title.trim(),
        description: description.trim(),
        mimeType: file.type,
        sizeBytes: file.size,
      });

      const mediaId = uploadSession.media.id;

      setPendingMediaId(mediaId);

      setMessage("Uploading video to secure storage...");

      await uploadVideoToStorage({
        uploadUrl: uploadSession.uploadUrl,
        file,
        requiredHeaders: uploadSession.requiredHeaders,
        onProgress: setProgress,
      });

      setMessage("Upload finished. Verifying video...");

      await verifyUploadedVideo(mediaId);
    } catch (uploadError) {
      setMessage("");

      setError(
        uploadError.response?.data?.message ||
          uploadError.message ||
          "Video upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleVerifyAgain() {
    if (!pendingMediaId || uploading) {
      return;
    }

    setUploading(true);

    try {
      await verifyUploadedVideo(pendingMediaId);
    } finally {
      setUploading(false);
    }
  }

  const videoSize = file
    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    : "";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div>
        <p className="text-sm font-medium text-rose-700">
          Creator Studio
        </p>

        <h1 className="mt-2 text-3xl font-bold text-gray-950">
          My content
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Upload videos to your private creator library.
          Videos must finish processing and moderation before
          they can be published.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="video-title"
            className="mb-2 block text-sm font-semibold text-gray-800"
          >
            Video title
          </label>

          <input
            id="video-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
            required
            disabled={uploading}
            placeholder="Give your video a title"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100 disabled:bg-gray-100"
          />
        </div>

        <div>
          <label
            htmlFor="video-description"
            className="mb-2 block text-sm font-semibold text-gray-800"
          >
            Description
          </label>

          <textarea
            id="video-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={4}
            disabled={uploading}
            placeholder="Tell your fans about this video..."
            className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100 disabled:bg-gray-100"
          />
        </div>

        <div>
          <label
            htmlFor="video-file"
            className="mb-2 block text-sm font-semibold text-gray-800"
          >
            Select video
          </label>

          <input
            id="video-file"
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full rounded-lg border border-gray-300 p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:font-semibold file:text-rose-700 hover:file:bg-rose-100 disabled:bg-gray-100"
          />

          <p className="mt-2 text-xs text-gray-500">
            MP4 or WebM. Maximum file size: 200 MB.
          </p>

          {file && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-medium">{file.name}</p>
              <p className="mt-1 text-xs text-gray-500">
                {videoSize}
              </p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">
                Upload progress
              </span>

              <span className="text-gray-600">
                {progress}%
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-rose-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || Boolean(pendingMediaId)}
          className="w-full rounded-lg bg-rose-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload video"}
        </button>

        {pendingMediaId && !uploading && (
          <button
            type="button"
            onClick={handleVerifyAgain}
            className="w-full rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Verify uploaded video
          </button>
        )}
      </form>

      {uploadedMedia && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">
            Upload received
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            {uploadedMedia.title}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {uploadedMedia.status}
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              Moderation: {uploadedMedia.moderationStatus}
            </span>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Your video is stored privately. It will not appear
            publicly until processing, moderation and publishing
            are complete.
          </p>
        </section>
      )}
    </div>
  );
}
