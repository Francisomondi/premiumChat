
import { useEffect, useState } from "react";
import { getPublicVideoPlayback } from "../../../api/services/publicVideoService";

function VideoPlayerModal({ video, onClose }) {
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(async () => {
      try {
        const response = await getPublicVideoPlayback(video.id);

        if (!cancelled) {
          setPlaybackUrl(response.video?.playbackUrl || "");
          setError(
            response.video?.playbackUrl
              ? ""
              : "A playback URL was not returned.",
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.response?.data?.message ||
              "This video could not be played.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [video.id]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Playing ${video.title}`}
        className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#19151e] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-white">
              {video.title}
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              @{video.creator?.username}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close video player"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="flex aspect-video items-center justify-center bg-black">
          {loading ? (
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#c0445c]" />
              <p className="mt-4 text-sm text-gray-400">
                Preparing video...
              </p>
            </div>
          ) : error ? (
            <div className="max-w-md px-6 text-center">
              <p className="text-sm text-red-300">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 rounded-lg border border-white/10 px-5 py-2 text-sm text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>
          ) : (
            <video
              key={playbackUrl}
              src={playbackUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            >
              Your browser does not support HTML video.
            </video>
          )}
        </div>

        {video.description && (
          <p className="px-5 py-4 text-sm leading-6 text-gray-400">
            {video.description}
          </p>
        )}
      </section>
    </div>
  );
}

export default VideoPlayerModal;
