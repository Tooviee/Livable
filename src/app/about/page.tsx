"use client";

import Link from "next/link";

const ABOUT = {
  name: "Livable Team",
  statement:
    "Livable is an initiative designed to assist the international community in Korea with navigating local bureaucracy and daily life. Our goal is to simplify complex processes that are difficult to manage without fluency in the language or familiarity with the system, offering direct, person-to-person assistance.",
  privacy:
    "Your information is only used to respond to your request. It is not shared with third parties or used for marketing. We use it solely to get in touch and help resolve the issue you submitted.",
  contactEmail: "liveabletogether@outlook.com",
  instagramUrl: "https://www.instagram.com/livablekorea/", // Livable Instagram — leave empty to hide the link
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight text-stone-100">
            Livable
          </Link>
          <nav className="flex gap-6">
            <Link
              href="/request"
              className="text-stone-400 hover:text-emerald-400 transition-colors"
            >
              Request help
            </Link>
            <Link
              href="/about"
              className="text-stone-400 hover:text-emerald-400 transition-colors"
            >
              About
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <h1 className="text-2xl font-semibold text-stone-100 mb-8">About</h1>

        <div className="space-y-6">
          <p className="text-stone-200 leading-relaxed">{ABOUT.statement}</p>
          <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-4">
            <p className="text-stone-300 text-sm leading-relaxed">
              <strong className="text-stone-200">Your data is protected.</strong>{" "}
              {ABOUT.privacy}
            </p>
          </div>
          {ABOUT.instagramUrl ? (
            <p className="text-sm">
              <a
                href={ABOUT.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Connect on Instagram →
              </a>
            </p>
          ) : null}
        </div>

        <p className="mt-10 text-stone-500 text-sm">
          <Link href="/" className="text-stone-400 hover:text-stone-200">
            ← Back to home
          </Link>
        </p>
      </main>

      <div className="px-4 mt-10">
        <div className="max-w-3xl mx-auto flex justify-end text-stone-400 text-sm">
          Contact us:{" "}
          <a
            href={`mailto:${ABOUT.contactEmail}`}
            className="text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {ABOUT.contactEmail}
          </a>
        </div>
      </div>
      <footer className="border-t border-stone-800 py-6 mt-4 px-4">
        <div className="max-w-3xl mx-auto flex justify-end text-stone-500 text-sm">
          <span>Livable — Helping you settle in.</span>
        </div>
      </footer>
    </div>
  );
}
