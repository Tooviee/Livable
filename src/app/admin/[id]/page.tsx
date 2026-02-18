"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { RequestRow } from "@/types/database";
import { getAppointmentSlotLabel } from "@/lib/appointment-slots";

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
  const [zoomLink, setZoomLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creatingZoomMeeting, setCreatingZoomMeeting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

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
        setZoomLink(data.zoom_link ?? "");
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message || "Failed to load request.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  const handleCreateZoomMeeting = async () => {
    if (!request?.id) return;
    const secret = getStoredSecret();
    if (!secret) return;
    setCreatingZoomMeeting(true);
    setError("");
    try {
      const res = await fetch(`/api/requests/${request.id}/create-zoom-meeting`, {
        method: "POST",
        headers: { "x-admin-secret": secret },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create Zoom meeting.");
      setZoomLink(data.zoom_link ?? "");
      setRequest((prev) => (prev ? { ...prev, zoom_link: data.zoom_link ?? null } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create Zoom meeting.");
    } finally {
      setCreatingZoomMeeting(false);
    }
  };

  const handleDelete = async () => {
    if (!request?.id) return;
    if (!window.confirm("Delete this request? Any Zoom meeting for this appointment will be cancelled. This cannot be undone.")) return;
    const secret = getStoredSecret();
    if (!secret) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      if (data.zoomCancelled === false) {
        alert("Request deleted. The Zoom meeting could not be cancelled automatically — please cancel it in Zoom if needed.");
      }
      router.push("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete request.");
    } finally {
      setDeleting(false);
    }
  };

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
        body: JSON.stringify({ status, internal_notes: internalNotes, zoom_link: zoomLink.trim() || null }),
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
          {(() => {
            const contact = "preferred_contact" in request && request.preferred_contact
              ? request.preferred_contact
              : ("wants_appointment" in request && request.wants_appointment ? "zoom" : "email");
            const contactLabel = contact === "zoom" ? "Virtual appointment (Zoom)" : contact === "instagram" ? "Instagram DM" : "Email";
            return (
              <div>
                <span className="text-stone-500 text-sm">Follow-up</span>
                <p className="text-stone-900 dark:text-stone-100">
                  {contactLabel}
                  {contact === "instagram" && "instagram_handle" in request && request.instagram_handle && (
                    <span> — @{String(request.instagram_handle).replace(/^@/, "")}</span>
                  )}
                </p>
              </div>
            );
          })()}
          {"wants_appointment" in request && request.wants_appointment && (
            <>
              {"appointment_date" in request && request.appointment_date && "appointment_time_slot" in request && request.appointment_time_slot && (
                <div>
                  <span className="text-stone-500 text-sm">Scheduled slot</span>
                  <p className="text-stone-900 dark:text-stone-100">
                    {new Date(request.appointment_date + "T12:00:00Z").toLocaleDateString("en-US", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    , {getAppointmentSlotLabel(request.appointment_time_slot)}
                  </p>
                </div>
              )}
              {request.appointment_preference && (
                <div>
                  <span className="text-stone-500 text-sm">Additional note</span>
                  <p className="text-stone-900 dark:text-stone-100">{request.appointment_preference}</p>
                </div>
              )}
            </>
          )}
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
          {"wants_appointment" in request && request.wants_appointment && (
            <div>
              <label htmlFor="zoom_link" className="block text-sm text-stone-600 dark:text-stone-400 mb-1">
                Zoom meeting link
              </label>
              <div className="flex flex-col gap-2">
                <input
                  id="zoom_link"
                  type="url"
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="https://zoom.us/j/..."
                />
                <div className="flex flex-wrap gap-2">
                  {"appointment_date" in request &&
                    request.appointment_date &&
                    "appointment_time_slot" in request &&
                    request.appointment_time_slot && (
                      <button
                        type="button"
                        onClick={handleCreateZoomMeeting}
                        disabled={creatingZoomMeeting || !!zoomLink.trim()}
                        className="rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-50"
                      >
                        {creatingZoomMeeting ? "Creating…" : "Create Zoom meeting"}
                      </button>
                    )}
                </div>
              </div>
              <p className="text-stone-500 text-xs mt-1">
                Create a Zoom meeting (requires Zoom API in .env) or paste a link if you created one elsewhere.
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium px-4 py-2"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-stone-200 dark:border-stone-800">
          <h2 className="text-lg font-medium text-stone-800 dark:text-stone-200 mb-2">Danger zone</h2>
          <p className="text-stone-600 dark:text-stone-400 text-sm mb-3">
            Deleting this request will also cancel the Zoom meeting (if one was created). This cannot be undone.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium px-4 py-2 text-sm"
          >
            {deleting ? "Deleting…" : "Delete request"}
          </button>
        </div>
      </main>
    </div>
  );
}
