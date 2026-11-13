
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  getMyCreatorProfile,
  updateMyCreatorProfile,
} from "../../../api/services/creatorService";

function EditCreatorProfilePage() {


  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    bio: "",
    country: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await getMyCreatorProfile();
        const currentProfile = response.profile || null;

        if (cancelled) return;

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

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await updateMyCreatorProfile(form);
      setProfile(response.profile);
      setSuccess("Your creator profile has been updated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-gray-400">Loading profile...</p>;
  }

  if (!profile || profile.applicationStatus !== "APPROVED") {
    return <Navigate to="/creator" replace />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-400">
          Creator workspace
        </p>
        <h1 className="mt-3 text-3xl font-bold">Edit profile</h1>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          Update the information fans see when they visit your creator profile.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-white/10 bg-[#19141e] p-5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-semibold">Profile information</h2>
          <p className="mt-1 text-sm text-gray-500">
            Keep your public information accurate and up to date.
          </p>
        </div>

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
              required
              disabled={saving}
              className="w-full bg-transparent px-3 py-3.5 text-sm outline-none"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Use letters, numbers and underscores.
          </p>
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
            disabled={saving}
            className="w-full rounded-xl border border-white/10 bg-[#100d13] px-4 py-3.5 text-sm outline-none focus:border-pink-500/60"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="bio" className="text-sm font-medium text-gray-300">
              Creator bio
            </label>
            <span className="text-xs text-gray-500">{form.bio.length}/500</span>
          </div>
          <textarea
            id="bio"
            name="bio"
            value={form.bio}
            onChange={handleChange}
            minLength={10}
            maxLength={500}
            rows={6}
            required
            disabled={saving}
            className="w-full resize-y rounded-xl border border-white/10 bg-[#100d13] px-4 py-3.5 text-sm leading-6 outline-none focus:border-pink-500/60"
          />
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
            disabled={saving}
            className="w-full rounded-xl border border-white/10 bg-[#100d13] px-4 py-3.5 text-sm outline-none focus:border-pink-500/60"
          />
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-pink-600 px-6 py-3 text-sm font-semibold transition hover:bg-pink-500 disabled:opacity-60"
          >
            {saving ? "Saving changes..." : "Save changes"}
          </button>

          <Link
            to="/creator/profile"
            className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default EditCreatorProfilePage;
