
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getMyCreatorProfile, submitCreatorApplication } from "../../../api/services/creatorService";

const EMPTY_FORM = {
  username: "",
  displayName: "",
  bio: "",
  country: "",
};

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    "Something went wrong. Please try again."
  );
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    REJECTED: "border-red-500/30 bg-red-500/10 text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
        styles[status] || "border-white/10 bg-white/5 text-gray-300"
      }`}
    >
      {status || "NOT SUBMITTED"}
    </span>
  );
}

function CreatorPortalPage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await getMyCreatorProfile();

        if (cancelled) return;

        const currentProfile = response.profile || null;
        setProfile(currentProfile);

        if (currentProfile) {
          setForm({
            username: currentProfile.username || "",
            displayName: currentProfile.displayName || "",
            bio: currentProfile.bio || "",
            country: currentProfile.country || "",
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    Promise.resolve().then(loadProfile);

    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await submitCreatorApplication(form);

      setProfile(response.profile);
      setSuccess(
        profile?.applicationStatus === "REJECTED"
          ? "Your application has been resubmitted."
          : "Your creator application has been submitted.",
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-400">
        Loading your creator workspace...
      </div>
    );
  }

  const status = profile?.applicationStatus;
  const isApproved = status === "APPROVED";
  const isPending = status === "PENDING";
  const isRejected = status === "REJECTED";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-400">
          Creator workspace
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {isApproved
            ? `Welcome, ${profile.displayName}`
            : "Creator overview"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
          Manage your creator profile, application and content workspace.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          {success}
        </div>
      )}

      {profile && (
        <section className="rounded-2xl border border-white/10 bg-[#19141e] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-400">Application status</p>
              <h2 className="mt-1 text-xl font-semibold">
                {isApproved
                  ? "Your creator account is approved"
                  : isPending
                    ? "Your application is being reviewed"
                    : "Your application needs attention"}
              </h2>
            </div>
            <StatusBadge status={status} />
          </div>

          {isPending && (
            <p className="mt-4 text-sm leading-6 text-gray-400">
              Your application has been received. We will update your status
              after it has been reviewed.
            </p>
          )}

          {isRejected && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm font-semibold text-red-300">
                Review feedback
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-300">
                {profile.rejectionReason || "Please review your details and resubmit your application."}
              </p>
            </div>
          )}

          {isApproved && (
            <p className="mt-4 text-sm leading-6 text-gray-400">
              Your profile is eligible to appear in public creator discovery.
            </p>
          )}
        </section>
      )}

      {isApproved ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#19141e] p-5">
              <p className="text-sm text-gray-500">Your username</p>
              <p className="mt-2 text-2xl font-bold">@{profile.username}</p>
              <p className="mt-2 text-xs text-gray-500">
                Your public creator identity
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#19141e] p-5">
              <p className="text-sm text-gray-500">Profile location</p>
              <p className="mt-2 text-2xl font-bold">{profile.country}</p>
              <p className="mt-2 text-xs text-gray-500">
                Country displayed on your profile
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#19141e] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Your creator profile</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Review the information fans can see.
                </p>
              </div>
              <Link
                to="/creator/profile"
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold transition hover:border-pink-500/50 hover:text-pink-300"
              >
                View profile
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/creator/profile/edit"
                className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold transition hover:bg-pink-500"
              >
                Edit profile
              </Link>
              <Link
                to={`/creators/${encodeURIComponent(profile.username)}`}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                Public profile
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#19141e] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Content studio</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Your video publishing workspace will live here.
                </p>
              </div>
              <Link
                to="/creator/content"
                className="rounded-xl border border-pink-500/30 px-4 py-3 text-sm font-semibold text-pink-300 transition hover:bg-pink-500/10"
              >
                Open content
              </Link>
            </div>
          </section>
        </>
      ) : isPending ? (
        <section className="rounded-2xl border border-white/10 bg-[#19141e] p-6">
          <h2 className="text-lg font-semibold">Submitted application</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-500">Username</p>
              <p className="mt-1 font-medium">@{profile.username}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Display name</p>
              <p className="mt-1 font-medium">{profile.displayName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Country</p>
              <p className="mt-1 font-medium">{profile.country}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Submitted</p>
              <p className="mt-1 font-medium">
                {profile.submittedAt
                  ? new Date(profile.submittedAt).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <p className="text-xs text-gray-500">Bio</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-300">
              {profile.bio}
            </p>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-[#19141e] p-6 sm:p-8">
          <div className="mb-7">
            <h2 className="text-xl font-semibold">
              {isRejected ? "Update your application" : "Apply to become a creator"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Tell us about yourself and the content you plan to create.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-300">
                Username
              </label>
              <div className="flex items-center rounded-xl border border-white/10 bg-[#100d13] focus-within:border-pink-500/60">
                <span className="pl-4 text-gray-500">@</span>
                <input
                  id="username"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  minLength={3}
                  maxLength={30}
                  pattern="[A-Za-z0-9_]+"
                  autoComplete="username"
                  required
                  disabled={isSubmitting}
                  placeholder="your_username"
                  className="w-full bg-transparent px-3 py-3.5 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="displayName" className="mb-2 block text-sm font-medium text-gray-300">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                value={form.displayName}
                onChange={handleChange}
                minLength={2}
                maxLength={50}
                required
                disabled={isSubmitting}
                placeholder="How fans will see you"
                className="w-full rounded-xl border border-white/10 bg-[#100d13] px-4 py-3.5 text-sm outline-none focus:border-pink-500/60"
              />
            </div>

            <div>
              <label htmlFor="bio" className="mb-2 block text-sm font-medium text-gray-300">
                Creator bio
              </label>
              <textarea
                id="bio"
                name="bio"
                value={form.bio}
                onChange={handleChange}
                minLength={10}
                maxLength={500}
                rows={5}
                required
                disabled={isSubmitting}
                placeholder="Tell fans about yourself and your content..."
                className="w-full resize-y rounded-xl border border-white/10 bg-[#100d13] px-4 py-3.5 text-sm leading-6 outline-none focus:border-pink-500/60"
              />
              <p className="mt-2 text-right text-xs text-gray-500">
                {form.bio.length}/500
              </p>
            </div>

            <div>
              <label htmlFor="country" className="mb-2 block text-sm font-medium text-gray-300">
                Country
              </label>
              <input
                id="country"
                name="country"
                value={form.country}
                onChange={handleChange}
                minLength={2}
                maxLength={80}
                required
                disabled={isSubmitting}
                placeholder="e.g. Kenya"
                className="w-full rounded-xl border border-white/10 bg-[#100d13] px-4 py-3.5 text-sm outline-none focus:border-pink-500/60"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-pink-600 px-5 py-3.5 text-sm font-semibold transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting
                ? "Please wait..."
                : isRejected
                  ? "Resubmit application"
                  : "Submit creator application"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

export default CreatorPortalPage;
