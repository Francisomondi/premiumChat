
import { Link } from "react-router-dom";

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100d13] px-5 py-12 text-white">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-10 block text-center">
          <span className="text-3xl font-bold tracking-tight">
            Premium <span className="text-fuchsia-400">Chat.</span>
          </span>
          <span className="mt-2 block text-sm text-gray-500">
            A place for creators and their communities
          </span>
        </Link>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-9">
          <h1 className="text-2xl font-bold">{title}</h1>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            {subtitle}
          </p>

          <div className="mt-8">{children}</div>
        </section>

        {footer && (
          <p className="mt-7 text-center text-sm text-gray-400">
            {footer}
          </p>
        )}

        <p className="mt-10 text-center text-xs text-gray-600">
          Premium Chat · Secure creator connections
        </p>
      </div>
    </main>
  );
}

export default AuthLayout;
