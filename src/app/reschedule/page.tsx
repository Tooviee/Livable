"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { APPOINTMENT_TIME_SLOTS, getAppointmentSlotLabel } from "@/lib/appointment-slots";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RescheduleContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<{
    name: string;
    appointment_date: string;
    appointment_time_slot: string;
  } | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newSlot, setNewSlot] = useState("");
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const minDate = useMemo(() => todayDateString(), []);

  useEffect(() => {
    if (!newDate) {
      setTakenSlots([]);
      return;
    }
    const url = token
      ? `/api/appointment-slots?date=${encodeURIComponent(newDate)}&token=${encodeURIComponent(token)}`
      : `/api/appointment-slots?date=${encodeURIComponent(newDate)}`;
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((data: { taken?: string[] }) => {
        if (!cancelled && Array.isArray(data.taken)) setTakenSlots(data.taken);
      })
      .catch(() => {
        if (!cancelled) setTakenSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [newDate, token]);

  useEffect(() => {
    if (takenSlots.length > 0 && newSlot && takenSlots.includes(newSlot)) setNewSlot("");
  }, [takenSlots, newSlot]);

  useEffect(() => {
    if (!token?.trim()) {
      setError("Invalid or missing link. Use the link from your confirmation or Zoom appointment email.");
      setLoading(false);
      return;
    }
    fetch(`/api/reschedule?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Invalid or expired link.");
        return r.json();
      })
      .then((data) => {
        setCurrent(data);
        setNewDate(data.appointment_date);
        setNewSlot(data.appointment_time_slot);
        setError("");
      })
      .catch(() => setError("Invalid or expired link. Use the link from your confirmation or Zoom appointment email."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !current || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          appointment_date: newDate,
          appointment_time_slot: newSlot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Link href="/" className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              Livable
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12">
          <p className="text-stone-500">Loading…</p>
        </main>
      </div>
    );
  }

  if (!token?.trim() || (!loading && !current && error)) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              Livable
            </Link>
            <Link href="/" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-sm">
              Back to home
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12">
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-4">Change appointment</h1>
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 text-amber-800 dark:text-amber-200">
            {error}
          </div>
          <p className="mt-4 text-stone-600 dark:text-stone-500 text-sm">
            Use the link from your confirmation email or from the email we sent with your Zoom appointment link.
          </p>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              Livable
            </Link>
            <Link href="/" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-sm">
              Back to home
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12">
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-4">Appointment changed</h1>
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200">
            Your appointment has been updated. Check your email for confirmation. We’ll send you a new Zoom link for the new time.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Livable
          </Link>
          <Link href="/" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-sm">
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
          Change your appointment
        </h1>
        <p className="text-stone-600 dark:text-stone-500 mb-8">
          Hi {current?.name}, choose a new date and time below. We’ll send you a new Zoom link for the updated slot.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900/50 p-4 mb-6">
          <p className="text-stone-500 text-sm mb-1">Current appointment</p>
          <p className="text-stone-900 dark:text-stone-100 font-medium">
            {current && formatDate(current.appointment_date)}, {current && getAppointmentSlotLabel(current.appointment_time_slot)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="new_date" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              New date
            </label>
            <input
              id="new_date"
              type="date"
              required
              min={minDate}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2.5 text-stone-900 dark:text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              New time slot
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {APPOINTMENT_TIME_SLOTS.map((slot) => {
                const taken = takenSlots.includes(slot.value);
                if (taken) {
                  return (
                    <div
                      key={slot.value}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-700 px-4 py-2.5 cursor-not-allowed bg-stone-100 dark:bg-stone-800/50"
                      aria-disabled="true"
                    >
                      <span className="text-sm text-stone-400 dark:text-stone-500">{slot.label}</span>
                      <span className="text-xs text-stone-400 dark:text-stone-500">(unavailable)</span>
                    </div>
                  );
                }
                return (
                  <label
                    key={slot.value}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 cursor-pointer transition-colors ${
                      newSlot === slot.value
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/50"
                        : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="new_slot"
                      value={slot.value}
                      checked={newSlot === slot.value}
                      onChange={() => setNewSlot(slot.value)}
                      className="sr-only"
                    />
                    <span className="text-sm text-stone-900 dark:text-stone-100">{slot.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-400 dark:disabled:bg-stone-600 disabled:cursor-not-allowed text-white font-medium py-3 transition-colors"
          >
            {submitting ? "Updating…" : "Update appointment"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function ReschedulePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-stone-500">Loading…</p>
        </div>
      }
    >
      <RescheduleContent />
    </Suspense>
  );
}
