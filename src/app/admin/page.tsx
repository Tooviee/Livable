"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RequestRow } from "@/types/database";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const ADMIN_SECRET_KEY = "livable-admin-secret";

export default function AdminPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState("");
  const [secretInput, setSecretInput] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(ADMIN_SECRET_KEY);
      if (stored) {
        setSecretInput(stored);
        setSecret(stored);
      }
    }
  }, []);

  useEffect(() => {
    if (!secret) return;
    const controller = new AbortController();
    fetch("/api/requests", {
      headers: { "x-admin-secret": secret },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Unauthorized or failed to load.");
        return r.json();
      })
      .then((data) => {
        setRequests(data.requests ?? []);
        setError("");
        sessionStorage.setItem(ADMIN_SECRET_KEY, secret);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message || "Failed to load requests.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [secret]);

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRequests([]);
    const value = secretInput.trim();
    if (value) setSecret(value);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-800">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight text-stone-100">
            Livable
          </Link>
          <span className="text-stone-500 text-sm">Admin</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-semibold text-stone-100 mb-6">Requests</h1>

        {!secret ? (
          <form onSubmit={handleLoad} className="space-y-4 max-w-sm">
            <label className="block text-sm text-stone-400">
              Admin secret (set in env as ADMIN_SECRET)
            </label>
            <div className="flex gap-2">
              <input
                name="secret"
                type="password"
                placeholder="Enter secret"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                className="flex-1 rounded-lg border border-stone-700 bg-stone-900 px-4 py-2 text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-stone-700 hover:bg-stone-600 px-4 py-2 text-stone-200 font-medium"
              >
                Load
              </button>
            </div>
          </form>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-stone-500">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="text-stone-500">No requests yet.</p>
            ) : (
              <div className="space-y-4">
                {requests.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/${r.id}`}
                    className="block rounded-xl border border-stone-800 bg-stone-900/50 p-4 hover:border-stone-600 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-stone-400 text-sm font-mono">
                        {r.id.slice(0, 8)}
                      </span>
                      <span className="text-stone-500 text-sm">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          r.status === "new"
                            ? "bg-amber-500/20 text-amber-400"
                            : r.status === "resolved" || r.status === "closed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-stone-600 text-stone-300"
                        }`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="font-medium text-stone-200">{r.name}</p>
                    <p className="text-stone-500 text-sm">{r.email}</p>
                    <p className="text-stone-400 text-sm mt-1">
                      {r.category} · {r.language}
                    </p>
                    <p className="text-stone-300 text-sm mt-2 line-clamp-2">
                      {r.message}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
