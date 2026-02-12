"use client";

import { useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  { value: "housing", label: "Housing" },
  { value: "visa", label: "Visa / residency" },
  { value: "banking", label: "Banking" },
  { value: "health", label: "Health insurance / medical" },
  { value: "government", label: "Government forms / documents" },
  { value: "tax", label: "Tax" },
  { value: "other", label: "Other" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "other", label: "Other" },
];

export default function RequestPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone") || null,
        language: data.get("language"),
        category: data.get("category"),
        message: data.get("message"),
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setErrorMessage(json.error || "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");
    form.reset();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight text-stone-100">
            Livable
          </Link>
          <nav className="flex gap-4 items-center">
            <Link href="/about" className="text-stone-400 hover:text-stone-200 text-sm">
              About
            </Link>
            <Link href="/" className="text-stone-400 hover:text-stone-200 text-sm">
              ← Back
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12">
        <h1 className="text-2xl font-semibold text-stone-100 mb-2">
          Submit a request
        </h1>
        <p className="text-stone-500 mb-8">
          We’ll confirm by email and follow up with next steps.
        </p>

        {status === "success" && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
            <p>Request submitted. Check your email for confirmation and next steps.</p>
            <p className="text-sm text-emerald-200/90">
              If you don’t see it, check your spam or junk folder — our confirmation emails sometimes land there.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-300 mb-1.5">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2.5 text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2.5 text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-stone-300 mb-1.5">
              Phone <span className="text-stone-500 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2.5 text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="+82 10 0000 0000"
            />
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-stone-300 mb-1.5">
              Preferred language
            </label>
            <select
              id="language"
              name="language"
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2.5 text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-stone-300 mb-1.5">
              Category
            </label>
            <select
              id="category"
              name="category"
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2.5 text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-stone-300 mb-1.5">
              Describe your request
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2.5 text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y min-h-[120px]"
              placeholder="What do you need help with? Include any relevant details (dates, documents, deadlines)."
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-600 disabled:cursor-not-allowed text-stone-950 font-medium py-3 transition-colors"
          >
            {status === "sending" ? "Sending…" : "Submit request"}
          </button>
        </form>
      </main>
    </div>
  );
}
