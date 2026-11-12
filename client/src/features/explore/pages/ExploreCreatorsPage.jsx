import useAuthStore from "../../../store/useAuthStore";

function ExploreCreatorsPage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  async function handleLogout() {
    const result = await logout();

    if (result.success) {
      window.location.href = "/login";
    }
  }

  return (
    <main className="min-h-screen bg-[#100d13] text-white">
      <header className="border-b border-white/10 bg-[#19151e]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Premium <span className="text-[#c0445c]">Chat</span>
            </h1>

            <p className="mt-1 text-xs text-gray-500">
              Discover. Connect. Experience.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c0445c]">
          Explore
        </p>

        <h2 className="mt-3 text-4xl font-bold tracking-tight">
          Discover your favourite creators.
        </h2>

        <p className="mt-4 max-w-2xl text-gray-400">
          Welcome, {user?.displayName}. Your age has been verified.
          You're ready to discover creators and their exclusive content.
        </p>

        <div className="mt-12 rounded-2xl border border-white/10 bg-[#19151e] p-8">
          <h3 className="text-xl font-semibold">
            Creator discovery is coming next
          </h3>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            Your account is verified and the Explore Creators
            destination is ready. We'll build the video-first creator
            discovery experience in the next module.
          </p>
        </div>
      </section>
    </main>
  );
}

export default ExploreCreatorsPage;