import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight text-stone-100">
            Livable
          </span>
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

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-stone-100 mb-4">
            Help for foreigners
            <br />
            <span className="text-emerald-400">living in Korea</span>
          </h1>
          <p className="text-lg text-stone-400 mb-10">
            Many services are limited to Korean nationals or Korean speakers.
            Submit your request here and we’ll get back to you with next steps.
          </p>
          <Link
            href="/request"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-medium px-6 py-3 transition-colors"
          >
            Submit a request
          </Link>
        </div>

        <section className="max-w-2xl mx-auto mt-24 grid sm:grid-cols-2 gap-6 text-left">
          <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-6">
            <h2 className="font-medium text-stone-200 mb-2">How it works</h2>
            <p className="text-stone-500 text-sm">
              Fill in your details and describe your issue. We’ll confirm by
              email and follow up with guidance or next steps.
            </p>
          </div>
          <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-6">
            <h2 className="font-medium text-stone-200 mb-2">What we can help with</h2>
            <p className="text-stone-500 text-sm">
              Housing, visas, banking, government forms, health insurance, and
              other day-to-day bureaucracy. Ask in English or your language.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-800 py-6">
        <div className="max-w-3xl mx-auto px-4 text-center text-stone-500 text-sm">
          Livable — Helping you settle in.
        </div>
      </footer>
    </div>
  );
}
