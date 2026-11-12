
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/AuthLayout";
import useAuthStore from "../../../store/useAuthStore";

function RegisterPage() {
  const navigate = useNavigate();

  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const clearError = useAuthStore((state) => state.clearError);

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    role: "FAN",
  });

  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    clearError();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (new TextEncoder().encode(form.password).length > 72) {
      setError("Password is too long. Please use a shorter password.");
      return;
    }

    const result = await register(form);

    if (!result.success) {
      setError(result.message);
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join Premium Chat and discover exclusive creator content."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-fuchsia-400 hover:text-fuchsia-300"
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="displayName"
            className="mb-2 block text-sm font-medium"
          >
            Display name
          </label>

          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={40}
            value={form.displayName}
            onChange={handleChange}
            placeholder="Your name"
            className="w-full rounded-lg border border-white/10 bg-[#17131c] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-fuchsia-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium">
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/10 bg-[#17131c] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-fuchsia-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium"
          >
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={form.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            className="w-full rounded-lg border border-white/10 bg-[#17131c] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-fuchsia-500"
          />

          <p className="mt-2 text-xs text-gray-500">
            Use at least 8 characters.
          </p>
        </div>

        <div>
          <label htmlFor="role" className="mb-2 block text-sm font-medium">
            I want to join as
          </label>

          <select
            id="role"
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full rounded-lg border border-white/10 bg-[#17131c] px-4 py-3 text-white outline-none transition focus:border-fuchsia-500"
          >
            <option value="FAN">Fan — discover and follow creators</option>
            <option value="CREATOR">Creator — publish exclusive content</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-fuchsia-600 px-5 py-3 font-semibold transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </button>

        <p className="text-xs leading-5 text-gray-500">
          By creating an account, you agree to use Premium Chat responsibly
          and comply with its platform rules.
        </p>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;
