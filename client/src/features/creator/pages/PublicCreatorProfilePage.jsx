import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPublicCreatorProfile } from "../../../api/services/creatorService";

function PublicCreatorProfilePage() {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        loadProfile();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

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
              Creator content
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Discover videos and exclusive content from {displayName}.
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#19151e]">
          <div className="flex min-h-80 flex-col items-center justify-center bg-gradient-to-br from-[#3d1c31] via-[#241725] to-[#100d13] px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl">
              ▶
            </div>

            <h3 className="mt-6 text-xl font-semibold">
              Videos coming soon
            </h3>

            <p className="mt-3 max-w-md text-sm leading-6 text-gray-400">
              This creator's videos and exclusive content will
              appear here when the content publishing feature
              is available.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-gray-600">
        Premium Chat · Discover. Connect. Experience.
      </footer>
    </main>
  );
}

export default PublicCreatorProfilePage;