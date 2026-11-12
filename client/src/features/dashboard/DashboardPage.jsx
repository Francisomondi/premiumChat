
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";

function DashboardPage() {
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);

  async function handleLogout() {
    const result = await logout();

    if (result.success) {
      navigate("/login", { replace: true });
    }
  }

  return (
    <main className="min-h-screen bg-[#100d13] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <h1 className="text-2xl font-bold">
            Premium <span className="text-fuchsia-400">Chat.</span>
          </h1>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
          >
            {isLoading ? "Please wait..." : "Log out"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-400">
          Your account
        </p>

        <h2 className="mt-4 text-4xl font-bold">
          Welcome, {user?.displayName}.
        </h2>

        <p className="mt-4 max-w-xl text-gray-400">
          Your Premium Chat account is active. We're building your creator
          experience, video discovery and private conversations.
        </p>

        <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-gray-500">Account role</p>
            <p className="mt-3 text-xl font-semibold">{user?.role}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-gray-500">Account status</p>
            <p className="mt-3 text-xl font-semibold text-green-400">
              {user?.status}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-gray-500">Email verification</p>
            <p className="mt-3 text-xl font-semibold">
              {user?.emailVerified ? "Verified" : "Not verified"}
            </p>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-7">
          <h3 className="text-lg font-semibold">
            Your Premium Chat journey starts here.
          </h3>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            The next modules will introduce creator profiles, video discovery,
            subscriptions, paid content and private messaging.
          </p>
        </section>
      </div>
    </main>
  );
}

export default DashboardPage;
