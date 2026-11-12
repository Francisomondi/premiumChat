import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../../store/useAuthStore";

function AgeVerificationPage() {
  const [dateOfBirth, setDateOfBirth] = useState("");

  const navigate = useNavigate();

  const verifyAge = useAuthStore((state) => state.verifyAge);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!dateOfBirth) {
      return;
    }

    const result = await verifyAge(dateOfBirth);

    if (result.success) {
      navigate("/explore", { replace: true });
    }
  }

  function handleDateChange(event) {
    setDateOfBirth(event.target.value);

    if (error) {
      clearError();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100d13] px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#8a2638]/40 bg-[#8a2638]/15 text-3xl">
            18+
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            Age verification
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            Before you explore creators on Premium Chat, we need
            to confirm that you are at least 18 years old.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-[#19151e] p-6 shadow-2xl sm:p-8"
        >
          <label
            htmlFor="dateOfBirth"
            className="mb-2 block text-sm font-medium text-gray-200"
          >
            Date of birth
          </label>

          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            required
            min="1900-01-01"
            max={today}
            value={dateOfBirth}
            onChange={handleDateChange}
            className="w-full rounded-xl border border-white/10 bg-[#100d13] px-4 py-3 text-white outline-none transition focus:border-[#c0445c] focus:ring-2 focus:ring-[#8a2638]/30"
          />

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!dateOfBirth || isLoading}
            className="mt-6 w-full rounded-xl bg-[#8a2638] px-5 py-3 font-semibold text-white transition hover:bg-[#a52e45] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Verifying..." : "Verify my age"}
          </button>

          <p className="mt-5 text-center text-xs leading-5 text-gray-500">
            By continuing, you confirm that the date of birth
            provided is accurate. You must be at least 18 years
            old to access this platform.
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Your date of birth is used for age verification and is
          not displayed on your public profile.
        </p>
      </div>
    </main>
  );
}

export default AgeVerificationPage;