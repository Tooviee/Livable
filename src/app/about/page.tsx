"use client";

import Link from "next/link";
import { useState } from "react";

// Edit these to match your details. Add your photo as public/me.jpg (square works best).
const ABOUT = {
  name: "Jung Ko",
  statement:
    "Livable is an initiative designed to assist the international community in Korea with navigating local bureaucracy and daily life. My goal is to simplify complex processes that are difficult to manage without fluency in the language or familiarity with the system, offering direct, person-to-person assistance.",
  privacy:
    "Your information is only used to respond to your request. It is not shared with third parties or used for marketing. I use it solely to get in touch and help resolve the issue you submitted.",
  instagramUrl: "https://www.instagram.com/jeonghun.ko/", // e.g. "https://instagram.com/yourhandle" — leave empty to hide the link
};

export default function AboutPage() {
  const [photoError, setPhotoError] = useState(false);

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

        <div className="flex flex-col sm:flex-row gap-8 items-start">
          <div className="shrink-0">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-stone-800 ring-2 ring-stone-700 flex items-center justify-center">
              {!photoError ? (
                <img
                  src="/me.jpg"
                  alt={ABOUT.name}
                  className="w-full h-full object-cover"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <span className="text-4xl font-medium text-stone-500">
                  {ABOUT.name.charAt(0)}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 flex-1 min-w-0">
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
        </div>

        <p className="mt-10 text-stone-500 text-sm">
          <Link href="/" className="text-stone-400 hover:text-stone-200">
            ← Back to home
          </Link>
        </p>
      </main>

      <footer className="border-t border-stone-800 py-6 mt-12">
        <div className="max-w-3xl mx-auto px-4 flex justify-end text-stone-500 text-sm">
          <span>Livable — Helping you settle in.</span>
        </div>
      </footer>
    </div>
  );
}
