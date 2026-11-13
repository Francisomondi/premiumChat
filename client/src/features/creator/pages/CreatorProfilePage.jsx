
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyCreatorProfile } from "../../../api/services/creatorService";

function CreatorProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await getMyCreatorProfile();
        if (!cancelled) setProfile(response.profile || null);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load your creator profile.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    Promise.resolve().then(loadProfile);

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="py-16 text-center text-sm text-gray-400">Loading profile...</p>;
  }

  if (error || !profile) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#19141e] p-6">
        <p className="text-sm text-red-300">{error || "Creator profile not found."}</p>
        <Link to="/creator" className="mt-5 inline-block text-sm text-pink-300">
          Back to overview
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-400">
            Creator workspace
          </p>
          <h1 className="mt-3 text-3xl font-bold">My profile</h1>
          <p className="mt-2 text-sm text-gray-400">
            This is the information currently displayed on your creator profile.
          </p>
        </div>

        <Link
          to="/creator/profile/edit"
          className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold transition hover:bg-pink-500"
        >
          Edit profile
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#19141e]">
        <div className="h-32 bg-gradient-to-r from-[#4c1839] via-[#81294f] to-[#24152c]" />

        <div className="px-6 pb-7">
          <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-[#19141e] bg-[#302033] text-3xl font-bold text-pink-300">
            {(profile.displayName || profile.username || "C")
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">{profile.displayName}</h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              APPROVED
            </span>
          </div>

          <p className="mt-1 text-sm text-pink-300">@{profile.username}</p>

          <div className="mt-7 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Display name
              </p>
              <p className="mt-2 text-sm font-medium">{profile.displayName || "—"}</p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Username
              </p>
              <p className="mt-2 text-sm font-medium">@{profile.username}</p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Country
              </p>
              <p className="mt-2 text-sm font-medium">{profile.country || "—"}</p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Member since
              </p>
              <p className="mt-2 text-sm font-medium">
                {profile.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          <div className="mt-7 border-t border-white/10 pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              About me
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-300">
              {profile.bio || "You haven't added a bio yet."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#19141e] p-5">
        <h3 className="font-semibold">Public profile</h3>
        <p className="mt-2 text-sm text-gray-400">
          Open the profile page that fans can access.
        </p>
        <Link
          to={`/creators/${encodeURIComponent(profile.username)}`}
          className="mt-4 inline-flex text-sm font-semibold text-pink-300 hover:text-pink-200"
        >
          View public profile →
        </Link>
      </section>
    </div>
  );
}

export default CreatorProfilePage;
