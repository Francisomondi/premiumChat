
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPublicCreatorProfile } from "../../../api/services/creatorService";
import { getPublicCreatorVideos } from "../../../api/services/publicVideoService";
import VideoPlayerModal from "../../explore/components/VideoPlayerModal";

const PAGE_SIZE = 12;

function VideoCard({ video, onPlay }) {
  const isFree = video.accessPolicy === "FREE";

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#19151e] transition hover:border-[#c0445c]/50">
      <button
        type="button"
        disabled={!isFree}
        onClick={() => isFree && onPlay(video)}
        aria-label={
          isFree
            ? `Play ${video.title}`
            : `${video.title} is restricted`
        }
        className="relative block aspect-video w-full overflow-hidden bg-gradient-to-br from-[#3d1c31] via-[#241725] to-[#100d13] text-left disabled:cursor-not-allowed"
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-white/30">
            ▶
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/30">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/60 text-xl text-white backdrop-blur">
            {isFree ? "▶" : "🔒"}
          </span>
        </div>

        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          {isFree
            ? "Free"
            : video.accessPolicy === "SUBSCRIBERS_ONLY"
              ? "Subscribers"
              : "Purchase"}
        </span>

        {video.durationSeconds > 0 && (
          <span className="absolute bottom-3 right-3 rounded bg-black/75 px-2 py-1 text-xs text-white">
            {Math.floor(video.durationSeconds / 60)}:
            {String(
              Math.floor(video.durationSeconds % 60),
            ).padStart(2, "0")}
          </span>
        )}
      </button>

      <div className="p-4">
        <h3 className="line-clamp-2 font-semibold text-white">
          {video.title}
        </h3>

        {video.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
            {video.description}
          </p>
        )}

        {!isFree && (
          <p className="mt-3 text-xs text-gray-500">
            {video.accessPolicy === "SUBSCRIBERS_ONLY"
              ? "A subscription is required to watch this video."
              : "A purchase is required to watch this video."}
          </p>
        )}
      </div>
    </article>
  );
}

function PublicCreatorProfilePage() {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [videos, setVideos] = useState([]);
  const [videoPage, setVideoPage] = useState(1);
  const [videoPages, setVideoPages] = useState(1);
  const [videoTotal, setVideoTotal] = useState(0);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videosError, setVideosError] = useState("");

  const [selectedVideo, setSelectedVideo] = useState(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getPublicCreatorProfile(username);
      setProfile(response.profile || null);
    } catch (requestError) {
      setProfile(null);
      setError(
        requestError.response?.data?.message ||
          "We couldn't load this creator's profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [username]);

  const loadVideos = useCallback(
    async (requestedPage = 1) => {
      setVideosLoading(true);
      setVideosError("");

      try {
        const response = await getPublicCreatorVideos(username, {
          page: requestedPage,
          limit: PAGE_SIZE,
        });

        setVideos(response.videos || []);
        setVideoPage(response.pagination?.page || requestedPage);
        setVideoPages(response.pagination?.totalPages || 1);
        setVideoTotal(response.pagination?.total || 0);
      } catch (requestError) {
        setVideos([]);
        setVideosError(
          requestError.response?.data?.message ||
            "We couldn't load this creator's videos.",
        );
      } finally {
        setVideosLoading(false);
      }
    },
    [username],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        loadProfile();
        loadVideos(1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadProfile, loadVideos]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100d13] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#c0445c]" />
          <p className="mt-4 text-sm text-gray-400">
            Loading creator profile...
          </p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100d13] px-5 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#19151e] p-8 text-center">
          <div className="text-4xl">✦</div>

          <h1 className="mt-5 text-2xl font-bold">
            Creator not found
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            {error || "This creator profile is unavailable."}
          </p>

          <Link
            to="/explore"
            className="mt-7 inline-flex rounded-lg bg-[#c0445c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a9364d]"
          >
            Explore creators
          </Link>
        </div>
      </main>
    );
  }

  const displayName = profile.displayName || profile.username;

  return (
    <main className="min-h-screen bg-[#100d13] text-white">
      <header className="border-b border-white/10 bg-[#19151e]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link to="/explore">
            <span className="text-xl font-bold">
              Premium <span className="text-[#c0445c]">Chat</span>
            </span>
          </Link>

          <Link
            to="/explore"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5"
          >
            Back to Explore
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(192,68,92,0.25),_transparent_60%)]" />

        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-24">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border border-[#c0445c]/40 bg-[#3d1c31] text-5xl font-bold text-[#e8a4b2] sm:h-40 sm:w-40">
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e0778c]">
                Creator profile
              </p>

              <h1 className="mt-3 break-words text-4xl font-bold tracking-tight sm:text-6xl">
                {displayName}
              </h1>

              <p className="mt-3 text-base text-gray-400">
                @{profile.username}
              </p>

              {profile.country && (
                <p className="mt-4 text-sm text-gray-400">
                  <span aria-hidden="true">📍</span>{" "}
                  {profile.country}
                </p>
              )}
            </div>
          </div>

          {profile.bio && (
            <div className="mt-10 max-w-3xl">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c0445c]">
                About
              </h2>

              <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-gray-300">
                {profile.bio}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c0445c]">
              Video-first experience
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Videos by {displayName}
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              {videosLoading
                ? "Loading videos..."
                : `${videoTotal} published video${videoTotal === 1 ? "" : "s"}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadVideos(videoPage)}
            disabled={videosLoading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Refresh videos
          </button>
        </div>

        {videosError && (
          <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 p-5">
            <p className="text-sm text-red-300">{videosError}</p>
            <button
              type="button"
              onClick={() => loadVideos(videoPage)}
              className="mt-3 text-sm font-semibold text-white underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {videosLoading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#19151e]"
              >
                <div className="aspect-video animate-pulse bg-white/5" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onPlay={setSelectedVideo}
                />
              ))}
            </div>

            {videoPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={videoPage <= 1 || videosLoading}
                  onClick={() => loadVideos(videoPage - 1)}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-30"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-500">
                  Page {videoPage} of {videoPages}
                </span>

                <button
                  type="button"
                  disabled={videoPage >= videoPages || videosLoading}
                  onClick={() => loadVideos(videoPage + 1)}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#19151e]">
            <div className="flex min-h-72 flex-col items-center justify-center bg-gradient-to-br from-[#3d1c31] via-[#241725] to-[#100d13] px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl">
                ▶
              </div>

              <h3 className="mt-6 text-xl font-semibold">
                No published videos yet
              </h3>

              <p className="mt-3 max-w-md text-sm leading-6 text-gray-400">
                This creator's published videos will appear here
                when they are ready to share.
              </p>
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-gray-600">
        Premium Chat · Discover. Connect. Experience.
      </footer>

      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </main>
  );
}

export default PublicCreatorProfilePage;
