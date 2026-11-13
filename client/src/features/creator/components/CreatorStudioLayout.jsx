
import { NavLink, Outlet, Link } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/creator", label: "Overview", end: true, icon: "⌂" },
  { to: "/creator/profile", label: "My profile", icon: "◉" },
  { to: "/creator/profile/edit", label: "Edit profile", icon: "✎" },
  { to: "/creator/content", label: "My content", icon: "▷" },
];

function CreatorStudioLayout() {
  return (
    <div className="min-h-screen bg-[#100d13] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#151019]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/creator" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-lg font-black">
              P
            </span>
            <span>
              <span className="block text-sm font-bold tracking-[0.16em]">
                PREMIUM CHAT
              </span>
              <span className="block text-xs text-gray-500">
                Creator Studio
              </span>
            </span>
          </Link>

          <Link
            to="/explore"
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:border-pink-500/40 hover:text-white"
          >
            View Explore
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#151019] p-4 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-5 hidden px-3 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Workspace
            </p>
          </div>

          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-pink-600/15 text-pink-300 ring-1 ring-pink-500/20"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <span className="w-5 text-center text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:block">
            <p className="text-sm font-semibold">Creator workspace</p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Manage your public presence and prepare exclusive content for
              your fans.
            </p>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-7 sm:px-6 sm:py-9 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default CreatorStudioLayout;
