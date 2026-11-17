
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import useAuthStore from "../../../store/useAuthStore";
import { getPublicCreators } from "../../../api/services/creatorService";
import { getPublicVideoFeed } from "../../../api/services/publicVideoService";
import VideoPlayerModal from "../components/VideoPlayerModal";

const PAGE_SIZE = 12;

function getCreatorList(response) {
  return (
    response?.creators ||
    response?.data?.creators ||
    response?.data?.items ||
    response?.items ||
    []
  );
}

function getPagination(response, currentPage) {
  const pagination = response?.pagination || response?.data?.pagination || {};

  return {
    page: Number(pagination.page || currentPage),
    pages: Number(
      pagination.pages || pagination.totalPages || 1,
    ),
    total: Number(
      pagination.total || pagination.totalCreators || 0,
    ),
  };
}

function getVideoList(response) {
  return response?.videos || response?.data?.videos || [];
}

function getVideoPagination(response, currentPage) {
  const pagination = response?.pagination || {};

  return {
    page: Number(pagination.page || currentPage),
    pages: Number(pagination.totalPages || 1),
    total: Number(pagination.total || 0),
  };
}

function CreatorCard({ creator }) {
  const username = creator.username || "creator";
  const displayName = creator.displayName || username;

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#19151e] transition hover:-translate-y-1 hover:border-[#c0445c]/50">
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-[#3d1c31] via-[#241725] to-[#100d13]">
        {creator.featuredVideo?.thumbnailUrl ? (
          <img
            src={creator.featuredVideo.thumbnailUrl}
            alt={`${displayName} featured video`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : creator.profileImageUrl ? (
          <img
            src={creator.profileImageUrl}
            alt={displayName}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/5 text-3xl font-bold text-[#e8a4b2]">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">
                Creator spotlight
              </p>
              <p className="mt-1 text-xs text-white/40">
                Explore creator content
              </p>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-5 pt-16">
          <p className="text-xs font-medium uppercase tracking-wider text-[#e8a4b2]">
            Creator
          </p>
          <h3 className="mt-1 truncate text-xl font-bold text-white">
            {displayName}
          </h3>
          <p className="mt-1 text-sm text-gray-300">@{username}</p>
        </div>
      </div>

      <div className="p-5">
        <p className="min-h-[3rem] text-sm leading-6 text-gray-400">
          {creator.bio || "This creator hasn't added a bio yet."}
        </p>

        {creator.country && (
          <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <span aria-hidden="true">📍</span>
            {creator.country}
          </p>
        )}

        <Link
          to={`/creators/${encodeURIComponent(username)}`}
          className="mt-5 block w-full rounded-lg bg-[#c0445c] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#a9364d]"
        >
          View creator profile
        </Link>
      </div>
    </article>
  );
}

function VideoCard({ video, onPlay }) {
  const creatorName =
    video.creator?.displayName ||
    video.creator?.username ||
    "Creator";

  const isFree = video.accessPolicy === "FREE";

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#19151e] transition hover:border-[#c0445c]/50">
      <button
        type="button"
        onClick={() => isFree && onPlay(video)}
        disabled={!isFree}
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

        <Link
          to={`/creators/${encodeURIComponent(video.creator?.username || "")}`}
          className="mt-2 inline-block text-sm text-[#e8a4b2] hover:text-white"
        >
          {creatorName}
        </Link>

        {video.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
            {video.description}
          </p>
        )}

        {!isFree && (
          <p className="mt-3 text-xs text-gray-500">
            {video.accessPolicy === "SUBSCRIBERS_ONLY"
              ? "A creator subscription is required."
              : "A purchase is required to watch this video."}
          </p>
        )}
      </div>
    </article>
  );
}

function ExploreCreatorsPage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [creators, setCreators] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const [videos, setVideos] = useState([]);
  const [videoPage, setVideoPage] = useState(1);
  const [videoPagination, setVideoPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCreators = useCallback(async (requestedPage = 1) => {
    setLoading(true);
    setError("");

    try {
      const response = await getPublicCreators({
        page: requestedPage,
        limit: PAGE_SIZE,
      });

      const creatorList = getCreatorList(response);
      const pageInfo = getPagination(response, requestedPage);

      setCreators(Array.isArray(creatorList) ? creatorList : []);
      setPagination(pageInfo);
      setPage(pageInfo.page);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We couldn't load creators. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVideos = useCallback(async (requestedPage = 1) => {
    setVideoLoading(true);
    setVideoError("");

    try {
      const response = await getPublicVideoFeed({
        page: requestedPage,
        limit: PAGE_SIZE,
      });

      setVideos(getVideoList(response));
      const pageInfo = getVideoPagination(response, requestedPage);
      setVideoPagination(pageInfo);
      setVideoPage(pageInfo.page);
    } catch (requestError) {
      setVideoError(
        requestError.response?.data?.message ||
          "We couldn't load published videos. Please try again.",
      );
    } finally {
      setVideoLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        loadCreators(1);
        loadVideos(1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadCreators, loadVideos]);

  const filteredCreators = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return creators;

    return creators.filter((creator) => {
      const searchableText = [
        creator.username,
        creator.displayName,
        creator.bio,
        creator.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [creators, search]);

  async function handleLogout() {
    const result = await logout();

    if (result.success) {
      window.location.href = "/login";
    }
  }

  function handleSearchChange(event) {
    setSearch(event.target.value);
  }

  return (
    <main className="min-h-screen bg-[#100d13] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#19151e]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link to="/explore" className="block">
            <h1 className="text-xl font-bold tracking-tight">
              Premium <span className="text-[#c0445c]">Chat</span>
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Discover. Connect. Experience.
            </p>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-gray-400 sm:block">
              {user?.displayName
                ? `Welcome, ${user.displayName}`
                : "Welcome"}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(192,68,92,0.22),_transparent_55%)]" />

        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e0778c]">
            Discover videos
          </p>

          <h2 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Watch what inspires you.
            <span className="block text-[#d66b82]">
              Discover your creators.
            </span>
          </h2>

          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-400">
            Explore published videos, meet their creators, and
            discover exclusive content and private conversations.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c0445c]">
              Fresh from creators
            </p>
            <h3 className="mt-2 text-3xl font-bold">
              Published videos
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {videoLoading
                ? "Loading videos..."
                : `${videoPagination.total} published video${videoPagination.total === 1 ? "" : "s"}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadVideos(videoPage)}
            disabled={videoLoading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Refresh videos
          </button>
        </div>

        {videoError && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/10 p-5">
            <p className="text-sm text-red-300">{videoError}</p>
            <button
              type="button"
              onClick={() => loadVideos(videoPage)}
              className="mt-3 text-sm font-semibold text-white underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {videoLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onPlay={setSelectedVideo}
                />
              ))}
            </div>

            {videoPagination.pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={videoPage <= 1 || videoLoading}
                  onClick={() => loadVideos(videoPage - 1)}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {videoPage} of {videoPagination.pages}
                </span>
                <button
                  type="button"
                  disabled={
                    videoPage >= videoPagination.pages || videoLoading
                  }
                  onClick={() => loadVideos(videoPage + 1)}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#19151e] px-6 py-16 text-center">
            <div className="text-4xl text-[#e8a4b2]">▶</div>
            <h4 className="mt-5 text-lg font-semibold">
              No published videos yet
            </h4>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Videos will appear here after creators upload, receive
              moderation approval, and publish their content.
            </p>
          </div>
        )}
      </section>

      <section className="border-t border-white/10 bg-[#151119]">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c0445c]">
                The community
              </p>
              <h3 className="mt-2 text-2xl font-bold">
                {search.trim() ? "Creator search results" : "Meet the creators"}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {loading
                  ? "Loading creators..."
                  : `${filteredCreators.length} creator${filteredCreators.length === 1 ? "" : "s"} shown`}
                {!search.trim() && pagination.total > 0
                  ? ` · ${pagination.total} approved in total`
                  : ""}
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-gray-400">
              Video-first discovery
            </span>
          </div>

          <div className="mb-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="creator-search">
              Search creators
            </label>
            <input
              id="creator-search"
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by name, username or country..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#19151e] px-5 py-4 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#c0445c]"
            />
            <button
              type="button"
              onClick={() => loadCreators(1)}
              disabled={loading}
              className="rounded-xl bg-[#c0445c] px-7 py-4 text-sm font-semibold text-white transition hover:bg-[#a9364d] disabled:opacity-60"
            >
              Refresh creators
            </button>
          </div>

          {error && (
            <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/10 p-5">
              <p className="text-sm text-red-300">{error}</p>
              <button
                type="button"
                onClick={() => loadCreators(page)}
                className="mt-3 text-sm font-semibold text-white underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-[#19151e]"
                >
                  <div className="aspect-[4/5] animate-pulse bg-white/5" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                    <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCreators.length > 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCreators.map((creator) => (
                  <CreatorCard
                    key={creator._id || creator.id || creator.username}
                    creator={creator}
                  />
                ))}
              </div>

              {!search.trim() && pagination.pages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => loadCreators(page - 1)}
                    className="rounded-lg border border-white/10 px-5 py-3 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {pagination.pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pagination.pages || loading}
                    onClick={() => loadCreators(page + 1)}
                    className="rounded-lg border border-white/10 px-5 py-3 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#19151e] px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-2xl">
                {search.trim() ? "⌕" : "✦"}
              </div>
              <h4 className="mt-5 text-lg font-semibold">
                {search.trim()
                  ? "No creators match your search"
                  : "No creators available yet"}
              </h4>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                {search.trim()
                  ? "Try another name, username or country."
                  : "Approved creator profiles will appear here as creators join the platform."}
              </p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-5 text-sm font-semibold text-[#e0778c] hover:text-white"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
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

export default ExploreCreatorsPage;
