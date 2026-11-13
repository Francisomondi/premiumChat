
import { Link } from "react-router-dom";

function CreatorContentPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-400">
          Creator workspace
        </p>
        <h1 className="mt-3 text-3xl font-bold">My content</h1>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          Your video publishing and content management workspace.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#19141e] px-6 py-14 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-600/10 text-3xl text-pink-300">
          ▷
        </div>
        <h2 className="mt-5 text-xl font-semibold">Your content studio is coming next</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-400">
          Soon you'll be able to upload videos, manage your content library,
          choose free or paid access, and publish videos for your fans.
        </p>
        <Link
          to="/creator"
          className="mt-7 inline-flex rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold transition hover:bg-white/5"
        >
          Back to overview
        </Link>
      </section>
    </div>
  );
}

export default CreatorContentPage;
