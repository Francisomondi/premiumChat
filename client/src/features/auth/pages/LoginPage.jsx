
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthLayout from "../components/AuthLayout";
import useAuthStore from "../../../store/useAuthStore";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const clearError = useAuthStore((state) => state.clearError);

  const [form, setForm] = useState({
    email: "",
    password: "",
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

    const result = await login(form);

    if (!result.success) {
      setError(result.message);
      return;
    }

    const destination = location.state?.from?.pathname || "/dashboard";

    navigate(destination, { replace: true });
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue connecting with your favourite creators."
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-fuchsia-400 hover:text-fuchsia-300"
          >
            Create account
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
          <label htmlFor="password" className="mb-2 block text-sm font-medium">
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={72}
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            className="w-full rounded-lg border border-white/10 bg-[#17131c] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-fuchsia-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-fuchsia-600 px-5 py-3 font-semibold transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
