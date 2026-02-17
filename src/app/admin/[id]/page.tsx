"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { RequestRow } from "@/types/database";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const ADMIN_SECRET_KEY = "livable-admin-secret";

function getStoredSecret(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ADMIN_SECRET_KEY) ?? "";
}

export default function AdminRequestDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    const secret = getStoredSecret();
    if (!secret) {
      setError("Admin secret required. Go back and enter it on the Requests list.");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/requests/${id}`, {
      headers: { "x-admin-secret": secret },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Request not found." : "Failed to load.");
        return r.json();
      })
      .then((data) => {
        setRequest(data);
        setStatus(data.status);
        setInternalNotes(data.internal_notes ?? "");
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message || "Failed to load request.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || saving) return;
    const secret = getStoredSecret();
    if (!secret) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ status, internal_notes: internalNotes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save.");
      }
      const data = await res.json();
      setRequest(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Link href="/admin" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-sm">
              ← Back to requests
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
          <p className="text-stone-500">Loading…</p>
        </main>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Link href="/admin" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-sm">
              ← Back to requests
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-300">
            {error}
          </div>
        </main>
      </div>
    );
  }

  if (!request) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/admin" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-sm">
            ← Back to requests
          </Link>
          <span className="text-stone-500 text-sm font-mono">{request.id.slice(0, 8)}…</span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-6">Request details</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm">
            Saved.
          </div>
        )}

        <div className="rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900/50 p-6 mb-8 space-y-4">
          <p className="text-stone-500 text-sm">
            Submitted {new Date(request.created_at).toLocaleString()}
          </p>
          <div>
            <span className="text-stone-500 text-sm">Name</span>
            <p className="text-stone-900 dark:text-stone-100 font-medium">{request.name}</p>
          </div>
          <div>
            <span className="text-stone-500 text-sm">Email</span>
            <p className="text-stone-900 dark:text-stone-100">
              <a href={`mailto:${request.email}`} className="text-emerald-600 hover:underline dark:text-emerald-400">
                {request.email}
              </a>
            </p>
          </div>
          {request.phone && (
            <div>
              <span className="text-stone-500 text-sm">Phone</span>
              <p className="text-stone-900 dark:text-stone-100">{request.phone}</p>
            </div>
          )}
          <div>
            <span className="text-stone-500 text-sm">Language</span>
            <p className="text-stone-900 dark:text-stone-100">{request.language}</p>
          </div>
          <div>
            <span className="text-stone-500 text-sm">Category</span>
            <p className="text-stone-900 dark:text-stone-100">{request.category}</p>
          </div>
          <div>
            <span className="text-stone-500 text-sm">Message</span>
            <p className="text-stone-900 dark:text-stone-100 mt-1 whitespace-pre-wrap">{request.message}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <h2 className="text-lg font-medium text-stone-800 dark:text-stone-200">Update request</h2>
          <div>
            <label htmlFor="status" className="block text-sm text-stone-600 dark:text-stone-400 mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2 text-stone-900 dark:text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm text-stone-600 dark:text-stone-400 mb-1">
              Internal notes (only you see these)
            </label>
            <textarea
              id="notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
              placeholder="Notes for yourself on how you’re handling this request…"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium px-4 py-2"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </main>
    </div>
  );
}
