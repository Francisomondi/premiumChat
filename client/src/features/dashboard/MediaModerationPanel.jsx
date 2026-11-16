
import { useCallback, useEffect, useState } from "react";

import {
  getPendingMediaModeration,
  reviewMedia,
  getMediaModerationPreview,
} from "../../api/services/mediaModerationService";

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) {
    return "Not available";
  }

  const value = Number(bytes);

  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) {
    return "Not available";
  }

  const total = Math.floor(Number(seconds));
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-gray-300">
        {value || "Not available"}
      </p>
    </div>
  );
}

function MediaModerationPanel() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMedia, setSelectedMedia] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [previewMedia, setPreviewMedia] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getPendingMediaModeration();
      setMedia(response.data?.media || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load the moderation queue.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadQueue);
  }, [loadQueue]);

  async function openPreview(item) {
    setPreviewMedia(item);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(true);

    try {
      const response = await getMediaModerationPreview(item.id);
      const url = response.data?.preview?.previewUrl;

      if (!url) {
        throw new Error("The preview URL was not returned.");
      }

      setPreviewUrl(url);
    } catch (requestError) {
      setPreviewError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to load the private video preview.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewMedia(null);
    setPreviewUrl("");
    setPreviewError("");
  }

  async function refreshPreview() {
    if (!previewMedia) return;
    await openPreview(previewMedia);
  }

  async function handleApproval(item) {
    const confirmed = window.confirm(
      `Approve "${item.title}" for publication eligibility?`,
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await reviewMedia(item.id, {
        decision: "APPROVED",
      });

      closePreview();

      setNotice(
        `"${item.title}" approved. The creator must still publish it.`,
      );

      await loadQueue();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to approve this video.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openRejection(item) {
    closePreview();
    setSelectedMedia(item);
    setRejectionReason("");
    setError("");
    setNotice("");
  }

  async function handleRejection() {
    const reason = rejectionReason.trim();

    if (reason.length < 5) {
      setError("Please provide a reason of at least 5 characters.");
      return;
    }

    if (!selectedMedia) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await reviewMedia(selectedMedia.id, {
        decision: "REJECTED",
        rejectionReason: reason,
      });

      setNotice(`"${selectedMedia.title}" was rejected.`);
      setSelectedMedia(null);
      setRejectionReason("");

      await loadQueue();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to reject this video.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10 border-t border-white/10 pt-8">
      {/* Section heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold text-white">
              Video moderation
            </h3>

            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
              {media.length} pending
            </span>
          </div>

          <p className="mt-1 text-sm text-gray-500">
            Review creator videos before they become eligible for publication.
          </p>
        </div>

        <button
          type="button"
          onClick={loadQueue}
          disabled={loading || submitting}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 disabled:opacity-50 sm:self-auto"
        >
          <span aria-hidden="true">↻</span>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Compact summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#19151e] px-4 py-3">
          <p className="text-xs text-gray-500">Awaiting review</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {media.length}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#19151e] px-4 py-3">
          <p className="text-xs text-gray-500">Processing</p>
          <p className="mt-1 text-sm font-semibold text-green-300">
            Completed
          </p>
        </div>

        <div className="col-span-2 rounded-xl border border-white/10 bg-[#19151e] px-4 py-3 sm:col-span-1">
          <p className="text-xs text-gray-500">Publication rule</p>
          <p className="mt-1 text-sm font-semibold text-gray-200">
            Approval + creator publishing
          </p>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300"
        >
          {notice}
        </div>
      )}

      {/* Queue */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-[#19151e] px-5 py-10 text-center text-sm text-gray-500">
            Loading moderation queue...
          </div>
        ) : media.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#19151e]/60 px-5 py-10 text-center">
            <div className="text-3xl">🎬</div>
            <h4 className="mt-3 font-semibold text-white">
              All caught up
            </h4>
            <p className="mt-1 text-sm text-gray-500">
              New processed videos awaiting review will appear here.
            </p>
          </div>
        ) : (
          media.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-white/10 bg-[#19151e] p-4 transition hover:border-white/20 sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                      PENDING REVIEW
                    </span>

                    <span className="text-xs text-gray-500">
                      {item.mediaType || "VIDEO"}
                    </span>

                    <span className="text-xs text-gray-600">
                      • {formatDate(item.uploadedAt || item.createdAt)}
                    </span>
                  </div>

                  <h4 className="mt-3 break-words text-base font-semibold text-white">
                    {item.title || "Untitled video"}
                  </h4>

                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-gray-400">
                    {item.description || "No description provided."}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
                    <Detail
                      label="Duration"
                      value={formatDuration(item.durationSeconds)}
                    />
                    <Detail
                      label="Resolution"
                      value={
                        item.width && item.height
                          ? `${item.width} × ${item.height}`
                          : "Not available"
                      }
                    />
                    <Detail
                      label="Processed size"
                      value={formatBytes(item.processedSizeBytes)}
                    />
                    <Detail
                      label="Original size"
                      value={formatBytes(item.sizeBytes)}
                    />
                    <Detail
                      label="Publication"
                      value={item.publicationStatus || "DRAFT"}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3 lg:w-44 lg:shrink-0 lg:flex-col lg:border-0 lg:pt-0">
                  <button
                    type="button"
                    disabled={submitting || previewLoading}
                    onClick={() => openPreview(item)}
                    className="flex-1 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-50 lg:w-full"
                  >
                    Watch video
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleApproval(item)}
                    className="flex-1 rounded-lg bg-green-600/15 px-3 py-2.5 text-sm font-semibold text-green-300 transition hover:bg-green-600/25 disabled:opacity-50 lg:w-full"
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => openRejection(item)}
                    className="flex-1 rounded-lg bg-red-600/10 px-3 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-600/20 disabled:opacity-50 lg:w-full"
                  >
                    Reject
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs text-gray-500">
                <span className="min-w-0 break-all">
                  Creator: {item.creatorId}
                </span>
                <span>
                  Processed: {formatDate(item.processingCompletedAt)}
                </span>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Private video preview modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-preview-title"
            className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#19151e] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#c0445c]">
                  Private moderation preview
                </p>
                <h3
                  id="media-preview-title"
                  className="mt-1 break-words text-lg font-bold text-white"
                >
                  {previewMedia.title || "Untitled video"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closePreview}
                aria-label="Close video preview"
                className="rounded-lg px-3 py-1 text-xl text-gray-400 hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="bg-black">
              {previewLoading ? (
                <div className="flex aspect-video items-center justify-center text-sm text-gray-400">
                  Loading secure video preview...
                </div>
              ) : previewError ? (
                <div className="flex aspect-video flex-col items-center justify-center gap-3 px-5 text-center">
                  <p className="text-sm text-red-300">{previewError}</p>
                  <button
                    type="button"
                    onClick={refreshPreview}
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10"
                  >
                    Retry preview
                  </button>
                </div>
              ) : previewUrl ? (
                <video
                  key={previewUrl}
                  src={previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video max-h-[65vh] w-full bg-black object-contain"
                >
                  Your browser does not support video playback.
                </video>
              ) : null}
            </div>

            <div className="flex flex-col justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
              <p className="text-xs leading-5 text-gray-500">
                This private preview link expires after 3 minutes.
                Refresh it if playback access expires.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshPreview}
                  disabled={previewLoading}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Refresh preview
                </button>

                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection dialog */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !submitting
            ) {
              setSelectedMedia(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-rejection-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#19151e] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-red-400">
                  Moderation decision
                </p>
                <h3
                  id="media-rejection-title"
                  className="mt-1 text-xl font-bold text-white"
                >
                  Reject video
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                disabled={submitting}
                aria-label="Close rejection dialog"
                className="rounded-lg px-3 py-1 text-xl text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-gray-400">
              Provide a clear reason for rejecting{" "}
              <span className="font-semibold text-white">
                {selectedMedia.title || "this video"}
              </span>
              .
            </p>

            <label
              htmlFor="media-rejection-reason"
              className="mt-5 block text-sm font-medium text-gray-300"
            >
              Rejection reason
            </label>

            <textarea
              id="media-rejection-reason"
              value={rejectionReason}
              onChange={(event) =>
                setRejectionReason(event.target.value)
              }
              rows={4}
              maxLength={1000}
              placeholder="Explain why this video does not meet the platform guidelines..."
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#100d13] p-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-400"
            />

            <div className="mt-2 flex justify-between text-xs text-gray-600">
              <span>Minimum 5 characters</span>
              <span>{rejectionReason.length}/1000</span>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                disabled={submitting}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRejection}
                disabled={
                  submitting || rejectionReason.trim().length < 5
                }
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Rejecting..." : "Confirm rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default MediaModerationPanel;
