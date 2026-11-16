
import { useCallback, useEffect, useState } from "react";

import {
  createVideoUpload,
  uploadVideoToStorage,
  completeVideoUpload,
  getCreatorMedia,
  publishCreatorMedia,
  unpublishCreatorMedia,
} from "../../../api/services/mediaService";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm"];

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatDate(date) {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusStyle(status) {
  const styles = {
    UPLOADING: "bg-sky-50 text-sky-700 ring-sky-200",
    PROCESSING: "bg-amber-50 text-amber-700 ring-amber-200",
    READY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    FAILED: "bg-red-50 text-red-700 ring-red-200",
    REJECTED: "bg-red-50 text-red-700 ring-red-200",
  };

  return styles[status] || "bg-slate-100 text-slate-700 ring-slate-200";
}

function getModerationLabel(status) {
  const labels = {
    PENDING: "Awaiting review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };

  return labels[status] || "Not reviewed";
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusStyle(status)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "UNKNOWN"}
    </span>
  );
}

function PublicationBadge({ status }) {
  const published = status === "PUBLISHED";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        published
          ? "bg-rose-50 text-rose-800"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

function StatCard({ label, value, description, icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    amber: "bg-amber-50 text-amber-800",
    emerald: "bg-emerald-50 text-emerald-800",
    rose: "bg-rose-50 text-rose-800",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>

      <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function UploadStep({ number, label, active, complete }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          complete
            ? "bg-emerald-100 text-emerald-800"
            : active
              ? "bg-rose-100 text-rose-800"
              : "bg-slate-100 text-slate-500"
        }`}
      >
        {complete ? "✓" : number}
      </span>

      <span
        className={`truncate text-xs font-semibold ${
          active || complete ? "text-slate-800" : "text-slate-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function CreatorMediaCard({
  media,
  onPublish,
  onUnpublish,
  actionLoading,
}) {
  const duration = formatDuration(media.durationSeconds);

  const canPublish =
    media.status === "READY" &&
    media.moderationStatus === "APPROVED" &&
    media.publicationStatus === "DRAFT";

  const canUnpublish =
    media.status === "READY" &&
    media.moderationStatus === "APPROVED" &&
    media.publicationStatus === "PUBLISHED";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={media.status} />
              <PublicationBadge status={media.publicationStatus} />
            </div>

            <h3 className="mt-3 break-words text-lg font-bold text-slate-950">
              {media.title || "Untitled video"}
            </h3>

            {media.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {media.description}
              </p>
            )}

            <p className="mt-3 text-xs text-slate-500">
              Added {formatDate(media.createdAt)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 sm:min-w-40">
            <p className="text-xs font-medium text-slate-500">
              Moderation
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              {getModerationLabel(media.moderationStatus)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Original size</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatBytes(media.sizeBytes)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Duration</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {duration || "Processing"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Resolution</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {media.width && media.height
                ? `${media.width} × ${media.height}`
                : "Pending"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Processed size</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {media.processedSizeBytes
                ? formatBytes(media.processedSizeBytes)
                : "Pending"}
            </p>
          </div>
        </div>

        {media.status === "PROCESSING" && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Your video is being processed
            </p>
            <p className="mt-1 text-sm leading-5 text-amber-800">
              We are preparing your video for moderation. It remains
              private during this stage.
            </p>
          </div>
        )}

        {media.status === "UPLOADING" && (
          <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-900">
              Upload confirmation pending
            </p>
            <p className="mt-1 text-sm text-sky-800">
              This video is awaiting upload completion.
            </p>
          </div>
        )}

        {media.status === "READY" &&
          media.moderationStatus === "PENDING" && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Processing complete — awaiting moderation
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Your video is ready for review but cannot be published yet.
              </p>
            </div>
          )}

        {canPublish && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              Your video has been approved!
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              It is ready. Publish it when you want to make it available
              to fans.
            </p>
          </div>
        )}

        {media.status === "FAILED" && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">
              Video processing failed
            </p>
            <p className="mt-1 text-sm text-red-800">
              This video is not available to fans. Please contact support
              if the problem persists.
            </p>
          </div>
        )}

        {media.moderationStatus === "REJECTED" && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">
              Video rejected during moderation
            </p>

            {media.rejectionReason && (
              <p className="mt-1 text-sm leading-5 text-red-800">
                Reason: {media.rejectionReason}
              </p>
            )}
          </div>
        )}

        {canPublish && (
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Ready to share with your fans?
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Publishing makes this video eligible for fan access.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onPublish(media)}
              disabled={actionLoading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-800 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-900 focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading ? "Publishing..." : "Publish video"}
            </button>
          </div>
        )}

        {canUnpublish && (
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Your video is published
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Fans can access it according to its access policy.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onUnpublish(media)}
              disabled={actionLoading}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading ? "Unpublishing..." : "Unpublish video"}
            </button>
          </div>
        )}

        {media.publishedAt && (
          <p className="mt-4 text-xs text-slate-500">
            Published {formatDate(media.publishedAt)}
          </p>
        )}
      </div>
    </article>
  );
}

function EmptyLibrary() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-800">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m10 9 5 3-5 3V9Z" />
        </svg>
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-950">
        Your video library is empty
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        Upload your first video to start building your creator library.
        Your videos will appear here as they move through processing
        and moderation.
      </p>
    </div>
  );
}

export default function CreatorContentPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);

  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState("idle");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [pendingMediaId, setPendingMediaId] = useState(null);
  const [uploadedMedia, setUploadedMedia] = useState(null);

  const [mediaItems, setMediaItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");

  const [actionMediaId, setActionMediaId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const refreshLibrary = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLibraryLoading(true);
      }

      try {
        const result = await getCreatorMedia();
        const fetchedMedia = result.media || [];

        setMediaItems(
          !uploadedMedia
            ? fetchedMedia
            : fetchedMedia.some(
                  (item) => item.id === uploadedMedia.id,
                )
              ? fetchedMedia
              : [uploadedMedia, ...fetchedMedia],
        );

        setLibraryError("");
      } catch (loadError) {
        setLibraryError(
          loadError.response?.data?.message ||
            "Could not load your creator library.",
        );
      } finally {
        setLibraryLoading(false);
      }
    },
    [uploadedMedia],
  );

  useEffect(() => {
    Promise.resolve().then(() => {
      refreshLibrary();
    });

    const interval = window.setInterval(() => {
      refreshLibrary();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshLibrary]);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setError("");
    setMessage("");
    setUploadStage("idle");

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
    setUploadStage("verifying");
    setMessage("Confirming your upload...");

    try {
      const result = await completeVideoUpload(mediaId);
      const confirmedMedia = result.media;

      if (confirmedMedia) {
        setUploadedMedia(confirmedMedia);

        setMediaItems((currentItems) => [
          confirmedMedia,
          ...currentItems.filter(
            (item) => item.id !== confirmedMedia.id,
          ),
        ]);
      }

      setPendingMediaId(null);
      setUploadStage("complete");

      setMessage(
        "Upload complete! Your video is now processing in the background.",
      );

      setTitle("");
      setDescription("");
      setFile(null);
      setProgress(100);

      await refreshLibrary();
    } catch (uploadError) {
      setMessage("");

      setError(
        uploadError.response?.data?.message ||
          uploadError.message ||
          "Could not verify the uploaded video.",
      );

      setUploadStage("idle");
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
    setUploadStage("preparing");

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
      setUploadStage("uploading");
      setMessage("Uploading your video to secure storage...");

      await uploadVideoToStorage({
        uploadUrl: uploadSession.uploadUrl,
        file,
        requiredHeaders: uploadSession.requiredHeaders,
        onProgress: setProgress,
      });

      setProgress(100);

      await verifyUploadedVideo(mediaId);
    } catch (uploadError) {
      setMessage("");
      setUploadStage("idle");

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
    if (!pendingMediaId || uploading) return;

    setUploading(true);

    try {
      await verifyUploadedVideo(pendingMediaId);
    } finally {
      setUploading(false);
    }
  }

  async function handlePublicationAction(media, action) {
    if (actionMediaId) return;

    setActionMediaId(media.id);
    setActionError("");
    setActionMessage("");

    try {
      const result =
        action === "publish"
          ? await publishCreatorMedia(media.id)
          : await unpublishCreatorMedia(media.id);

      const updatedMedia = result.media;

      if (!updatedMedia) {
        throw new Error(
          "The server did not return the updated video.",
        );
      }

      setMediaItems((currentItems) =>
        currentItems.map((item) =>
          item.id === updatedMedia.id ? updatedMedia : item,
        ),
      );

      setUploadedMedia((currentMedia) =>
        currentMedia?.id === updatedMedia.id
          ? updatedMedia
          : currentMedia,
      );

      setActionMessage(
        result.message ||
          (action === "publish"
            ? "Your video has been published."
            : "Your video has been unpublished."),
      );
    } catch (publicationError) {
      setActionError(
        publicationError.response?.data?.message ||
          publicationError.message ||
          "Could not update video publication status.",
      );
    } finally {
      setActionMediaId(null);
    }
  }

  function handlePublish(media) {
    return handlePublicationAction(media, "publish");
  }

  function handleUnpublish(media) {
    const confirmed = window.confirm(
      "Are you sure you want to unpublish this video? Fans will no longer be able to access it through normal publication access.",
    );

    if (!confirmed) return;

    return handlePublicationAction(media, "unpublish");
  }

  const videoSize = file ? formatBytes(file.size) : "";

  const processingCount = mediaItems.filter(
    (media) =>
      media.status === "UPLOADING" ||
      media.status === "PROCESSING",
  ).length;

  const readyCount = mediaItems.filter(
    (media) =>
      media.status === "READY" &&
      media.moderationStatus === "APPROVED" &&
      media.publicationStatus === "DRAFT",
  ).length;

  const publishedCount = mediaItems.filter(
    (media) => media.publicationStatus === "PUBLISHED",
  ).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12">
      {/* Dashboard heading */}
      <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-rose-700/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-300">
              Creator Studio
            </p>

            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your content, your stage.
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
              Manage your videos, follow their review progress and
              decide when approved content becomes available to fans.
            </p>
          </div>

          <a
            href="#upload-video"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-400/30"
          >
            <span className="text-lg leading-none">+</span>
            Upload a video
          </a>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-slate-300">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Secure private storage
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            Creator-controlled publishing
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Moderation protected
          </span>
        </div>
      </header>

      {/* Library overview */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total videos"
          value={mediaItems.length}
          description="Videos in your library"
          icon="▣"
          tone="slate"
        />

        <StatCard
          label="Processing"
          value={processingCount}
          description="Uploads being prepared"
          icon="◷"
          tone="amber"
        />

        <StatCard
          label="Ready to publish"
          value={readyCount}
          description="Approved videos waiting for you"
          icon="✓"
          tone="emerald"
        />

        <StatCard
          label="Published"
          value={publishedCount}
          description="Videos currently published"
          icon="▶"
          tone="rose"
        />
      </section>

      {/* Upload section */}
      <section
        id="upload-video"
        className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <form
          onSubmit={handleSubmit}
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">
              Create something new
            </p>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
              Upload your video
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Add your video details and upload it securely to your
              creator library.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label
                htmlFor="video-title"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Video title <span className="text-rose-600">*</span>
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
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-rose-600 focus:ring-4 focus:ring-rose-100 disabled:bg-slate-100"
              />

              <p className="mt-1.5 text-right text-xs text-slate-400">
                {title.length}/100
              </p>
            </div>

            <div>
              <label
                htmlFor="video-description"
                className="mb-2 block text-sm font-semibold text-slate-800"
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
                placeholder="Tell your fans what this video is about..."
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-rose-600 focus:ring-4 focus:ring-rose-100 disabled:bg-slate-100"
              />

              <p className="mt-1.5 text-right text-xs text-slate-400">
                {description.length}/2000
              </p>
            </div>

            <div>
              <label
                htmlFor="video-file"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Video file <span className="text-rose-600">*</span>
              </label>

              <label
                htmlFor="video-file"
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-9 text-center transition ${
                  file
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-300 bg-slate-50 hover:border-rose-400 hover:bg-rose-50/40"
                } ${uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="h-7 w-7"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                    <path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
                  </svg>
                </span>

                <span className="mt-4 text-sm font-bold text-slate-800">
                  {file ? "Video selected" : "Choose a video to upload"}
                </span>

                <span className="mt-1 max-w-full break-all text-xs text-slate-500">
                  {file
                    ? file.name
                    : "Browse your device or choose a file"}
                </span>

                {file && (
                  <span className="mt-3 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    {videoSize}
                  </span>
                )}
              </label>

              <input
                id="video-file"
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleFileChange}
                disabled={uploading}
                className="sr-only"
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                MP4 or WebM. Maximum file size: 200 MB.
              </p>
            </div>
          </div>

          {uploading && (
            <div className="mt-6 space-y-4 rounded-xl border border-rose-100 bg-rose-50/70 p-4">
              <div className="grid grid-cols-3 gap-2">
                <UploadStep
                  number="1"
                  label="Prepare"
                  active={uploadStage === "preparing"}
                  complete={["uploading", "verifying", "complete"].includes(
                    uploadStage,
                  )}
                />

                <UploadStep
                  number="2"
                  label="Upload"
                  active={uploadStage === "uploading"}
                  complete={["verifying", "complete"].includes(
                    uploadStage,
                  )}
                />

                <UploadStep
                  number="3"
                  label="Confirm"
                  active={uploadStage === "verifying"}
                  complete={uploadStage === "complete"}
                />
              </div>

              {uploadStage === "uploading" && (
                <div>
                  <div className="mb-2 flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">
                      Upload progress
                    </span>
                    <span className="text-rose-800">{progress}%</span>
                  </div>

                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-rose-100"
                    role="progressbar"
                    aria-label="Video upload progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <div
                      className="h-full rounded-full bg-rose-700 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-sm font-medium text-rose-900">
                {message}
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-800"
            >
              {error}
            </div>
          )}

          {message && !uploading && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-5 text-emerald-900"
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || Boolean(pendingMediaId)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-800 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-900 focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Please wait..." : "Upload video"}
          </button>

          {pendingMediaId && !uploading && (
            <button
              type="button"
              onClick={handleVerifyAgain}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Verify uploaded video
            </button>
          )}
        </form>

        {/* Upload information */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-950">
              Your publishing journey
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Every upload follows these steps before reaching your fans.
            </p>

            <div className="mt-5 space-y-5">
              {[
                {
                  number: "01",
                  title: "Upload",
                  detail: "Send your video to secure storage.",
                },
                {
                  number: "02",
                  title: "Processing",
                  detail: "We optimize your video for playback.",
                },
                {
                  number: "03",
                  title: "Moderation",
                  detail: "Your video is reviewed for approval.",
                },
                {
                  number: "04",
                  title: "Publish",
                  detail: "You decide when approved content goes live.",
                },
              ].map((step, index) => (
                <div key={step.number} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-xs font-extrabold text-rose-800">
                      {step.number}
                    </span>

                    {index !== 3 && (
                      <span className="mt-2 h-5 w-px bg-slate-200" />
                    )}
                  </div>

                  <div className="pt-0.5">
                    <p className="text-sm font-bold text-slate-800">
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                ✓
              </span>

              <h3 className="text-sm font-bold text-emerald-950">
                Private by default
              </h3>
            </div>

            <p className="mt-3 text-sm leading-6 text-emerald-900">
              Your original and processed videos remain in private storage.
              Fans cannot access them before the required publication and
              access checks are satisfied.
            </p>
          </div>
        </aside>
      </section>

      {/* Video library */}
      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">
              Manage your content
            </p>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
              Your video library
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage your uploads, moderation and publication status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => refreshLibrary(true)}
            disabled={libraryLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2" />
            </svg>

            {libraryLoading ? "Refreshing..." : "Refresh library"}
          </button>
        </div>

        {processingCount > 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-amber-900">
              {processingCount} video
              {processingCount === 1 ? "" : "s"} still processing
            </p>

            <p className="text-xs text-amber-800">
              Your library refreshes automatically.
            </p>
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {actionError}
          </div>
        )}

        {actionMessage && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            {actionMessage}
          </div>
        )}

        {libraryError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {libraryError}
          </div>
        )}

        {libraryLoading && mediaItems.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-rose-700" />

            <p className="mt-4 text-sm font-medium text-slate-600">
              Loading your video library...
            </p>
          </div>
        )}

        {!libraryLoading &&
          mediaItems.length === 0 &&
          !libraryError && <EmptyLibrary />}

        {mediaItems.length > 0 && (
          <div className="space-y-4">
            {mediaItems.map((media) => (
              <CreatorMediaCard
                key={media.id}
                media={media}
                onPublish={handlePublish}
                onUnpublish={handleUnpublish}
                actionLoading={actionMediaId === media.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
