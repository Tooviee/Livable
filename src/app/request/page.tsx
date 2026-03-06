"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { APPOINTMENT_TIME_SLOTS } from "@/lib/appointment-slots";
import { buildIcsBlob, downloadIcs, livableEventStrings, getAppointmentSlotLabel } from "@/lib/calendar";

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
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "ru", label: "Русский язык" },
  { value: "mn", label: "Монгол хэл" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "hi", label: "हिन्दी" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "tl", label: "Tagalog" },
  { value: "th", label: "ภาษาไทย" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "ar", label: "اللغة العربية" },
  { value: "ko", label: "한국어" },
  { value: "other", label: "Other" },
];

function todayDateString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

type PreferredContact = "zoom" | "email" | "instagram";

type ConfirmationData = {
  name: string;
  category: string;
  message: string;
  preferredContact: PreferredContact;
  appointmentDate: string | null;
  appointmentTimeSlot: string | null;
  instagramHandle: string | null;
};

export default function RequestPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);
  const [preferredContact, setPreferredContact] = useState<PreferredContact>("zoom");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTimeSlot, setAppointmentTimeSlot] = useState("");
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [pastSlots, setPastSlots] = useState<string[]>([]);
  const [instagramHandle, setInstagramHandle] = useState("");
  const minDate = useMemo(() => todayDateString(), []);

  useEffect(() => {
    if (!appointmentDate) {
      setTakenSlots([]);
      setPastSlots([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/appointment-slots?date=${encodeURIComponent(appointmentDate)}`)
      .then((r) => r.json())
      .then((data: { taken?: string[]; past?: string[] }) => {
        if (cancelled) return;
        if (Array.isArray(data.taken)) setTakenSlots(data.taken);
        if (Array.isArray(data.past)) setPastSlots(data.past);
      })
      .catch(() => {
        if (!cancelled) {
          setTakenSlots([]);
          setPastSlots([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentDate]);

  const unavailableSlots = useMemo(
    () => new Set([...takenSlots, ...pastSlots]),
    [takenSlots, pastSlots]
  );

  useEffect(() => {
    if (unavailableSlots.has(appointmentTimeSlot)) setAppointmentTimeSlot("");
  }, [unavailableSlots, appointmentTimeSlot]);

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
        preferred_contact: preferredContact,
        wants_appointment: preferredContact === "zoom",
        appointment_preference:
          preferredContact === "zoom" ? (data.get("appointment_preference") as string) || null : null,
        appointment_date: preferredContact === "zoom" ? appointmentDate || null : null,
        appointment_time_slot: preferredContact === "zoom" ? appointmentTimeSlot || null : null,
        instagram_handle: preferredContact === "instagram" ? instagramHandle.trim() || null : null,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setErrorMessage(json.error || "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");
    setConfirmationData({
      name: String(data.get("name") ?? ""),
      category: String(data.get("category") ?? ""),
      message: String(data.get("message") ?? ""),
      preferredContact,
      appointmentDate: preferredContact === "zoom" ? appointmentDate || null : null,
      appointmentTimeSlot: preferredContact === "zoom" ? appointmentTimeSlot || null : null,
      instagramHandle: preferredContact === "instagram" ? instagramHandle.trim() || null : null,
    });
    form.reset();
    setPreferredContact("zoom");
    setAppointmentDate("");
    setAppointmentTimeSlot("");
    setInstagramHandle("");
  }

  function closeConfirmation() {
    setConfirmationData(null);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {confirmationData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 dark:bg-stone-950/70"
          aria-modal="true"
          role="dialog"
          aria-labelledby="confirmation-title"
        >
          <div className="bg-white dark:bg-stone-900 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-stone-200 dark:border-stone-700">
            <div className="p-6 space-y-5">
              <h2 id="confirmation-title" className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                Request submitted
              </h2>
              <p className="text-stone-600 dark:text-stone-400 text-sm">
                Check your email for confirmation and next steps. Summary of your request:
              </p>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-stone-500 dark:text-stone-400">Name</dt>
                  <dd className="text-stone-900 dark:text-stone-100 font-medium">{confirmationData.name}</dd>
                </div>
                <div>
                  <dt className="text-stone-500 dark:text-stone-400">Category</dt>
                  <dd className="text-stone-900 dark:text-stone-100">
                    {CATEGORIES.find((c) => c.value === confirmationData.category)?.label ?? confirmationData.category}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500 dark:text-stone-400">Message</dt>
                  <dd className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap break-words">
                    {confirmationData.message.length > 300
                      ? confirmationData.message.slice(0, 300) + "…"
                      : confirmationData.message}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500 dark:text-stone-400">Follow-up</dt>
                  <dd className="text-stone-900 dark:text-stone-100">
                    {confirmationData.preferredContact === "zoom" &&
                    confirmationData.appointmentDate &&
                    confirmationData.appointmentTimeSlot ? (
                      <>
                        Virtual appointment (Zoom) —{" "}
                        {new Date(confirmationData.appointmentDate + "T12:00:00Z").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        , {getAppointmentSlotLabel(confirmationData.appointmentTimeSlot)}
                      </>
                    ) : confirmationData.preferredContact === "email" ? (
                      "Email"
                    ) : confirmationData.preferredContact === "instagram" ? (
                      <>Instagram{confirmationData.instagramHandle ? ` (@${confirmationData.instagramHandle.replace(/^@/, "")})` : ""}</>
                    ) : (
                      ""
                    )}
                  </dd>
                </div>
              </dl>
              {confirmationData.preferredContact === "zoom" &&
                confirmationData.appointmentDate &&
                confirmationData.appointmentTimeSlot && (() => {
                  const slotLabel = getAppointmentSlotLabel(confirmationData.appointmentTimeSlot!);
                  const catLabel = CATEGORIES.find((c) => c.value === confirmationData.category)?.label ?? confirmationData.category;
                  const msgSnippet = confirmationData.message.slice(0, 200);
                  const { title, description } = livableEventStrings(slotLabel, catLabel, msgSnippet);
                  const addToCalendar = () => {
                    const blob = buildIcsBlob(
                      title,
                      description,
                      confirmationData.appointmentDate!,
                      confirmationData.appointmentTimeSlot!
                    );
                    downloadIcs(blob);
                  };
                  return (
                    <div className="pt-3 border-t border-stone-200 dark:border-stone-700">
                      <button
                        type="button"
                        onClick={addToCalendar}
                        className="w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-4 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors"
                      >
                        Add to calendar
                      </button>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                        Opens a file you can add to any calendar app (Apple Calendar, Google Calendar, Outlook, Notion Calendar, etc.).
                      </p>
                    </div>
                  );
                })()}
              <button
                type="button"
                onClick={closeConfirmation}
                className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium py-2.5 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Livable
          </Link>
          <nav className="flex gap-4 items-center">
            <Link href="/about" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-sm">
              About
            </Link>
            <Link href="/" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-sm">
              ← Back
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
          Submit a request
        </h1>
        <p className="text-stone-600 dark:text-stone-500 mb-8">
          We’ll confirm by email and follow up with next steps.
        </p>

        {status === "success" && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-2">
            <p>Request submitted. Check your email for confirmation and next steps.</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-200/90">
              If you don’t see it, check your spam or junk folder — our confirmation emails sometimes land there.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2.5 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2.5 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Phone <span className="text-stone-500 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2.5 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="+82 10 0000 0000"
            />
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Preferred language
            </label>
            <select
              id="language"
              name="language"
              required
              className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2.5 text-stone-900 dark:text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Category
            </label>
            <select
              id="category"
              name="category"
              required
              className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2.5 text-stone-900 dark:text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Describe your request
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2.5 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y min-h-[120px]"
              placeholder="What do you need help with? Include any relevant details (dates, documents, deadlines)."
            />
          </div>

          <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 p-4 space-y-4">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
              How would you like us to follow up?
            </p>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  preferredContact === "zoom"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/50"
                    : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
                }`}
              >
                <input
                  type="radio"
                  name="preferred_contact"
                  value="zoom"
                  checked={preferredContact === "zoom"}
                  onChange={() => {
                    setPreferredContact("zoom");
                    setInstagramHandle("");
                  }}
                  className="mt-1"
                />
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  Virtual appointment (Zoom)
                </span>
              </label>
              <label
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  preferredContact === "email"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/50"
                    : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
                }`}
              >
                <input
                  type="radio"
                  name="preferred_contact"
                  value="email"
                  checked={preferredContact === "email"}
                  onChange={() => {
                    setPreferredContact("email");
                    setAppointmentDate("");
                    setAppointmentTimeSlot("");
                    setInstagramHandle("");
                  }}
                  className="mt-1"
                />
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  I prefer to communicate via email
                </span>
              </label>
              <label
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  preferredContact === "instagram"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/50"
                    : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
                }`}
              >
                <input
                  type="radio"
                  name="preferred_contact"
                  value="instagram"
                  checked={preferredContact === "instagram"}
                  onChange={() => {
                    setPreferredContact("instagram");
                    setAppointmentDate("");
                    setAppointmentTimeSlot("");
                  }}
                  className="mt-1"
                />
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  I prefer to communicate via Instagram
                </span>
              </label>
            </div>
            {preferredContact === "zoom" && (
              <div className="min-w-0 pl-6 space-y-4 border-l-2 border-emerald-200 dark:border-emerald-800 ml-1">
                <div className="w-full max-w-[200px]">
                  <label htmlFor="appointment_date" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Date
                  </label>
                  <input
                    id="appointment_date"
                    name="appointment_date"
                    type="date"
                    required
                    min={minDate}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full max-w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 box-border"
                    style={{ width: "100%", maxWidth: "200px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                    Time slot
                  </label>
                  {!appointmentDate ? (
                    <p className="text-sm text-stone-500 dark:text-stone-400 rounded-lg border border-dashed border-stone-300 dark:border-stone-600 px-4 py-3 bg-stone-50 dark:bg-stone-800/30">
                      Please select the date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {APPOINTMENT_TIME_SLOTS.map((slot) => {
                        const unavailable = unavailableSlots.has(slot.value);
                        if (unavailable) {
                          return (
                            <div
                              key={slot.value}
                              className="flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-700 px-4 py-2.5 cursor-not-allowed bg-stone-100 dark:bg-stone-800/50"
                              aria-disabled="true"
                            >
                              <span className="text-sm text-stone-400 dark:text-stone-500">{slot.label}</span>
                            </div>
                          );
                        }
                        return (
                          <label
                            key={slot.value}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 cursor-pointer transition-colors ${
                              appointmentTimeSlot === slot.value
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/50"
                                : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
                            }`}
                          >
                            <input
                              type="radio"
                              name="appointment_time_slot"
                              value={slot.value}
                              checked={appointmentTimeSlot === slot.value}
                              onChange={() => setAppointmentTimeSlot(slot.value)}
                              className="sr-only"
                            />
                            <span className="text-sm text-stone-900 dark:text-stone-100">{slot.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="appointment_preference" className="block text-sm text-stone-600 dark:text-stone-400 mb-1">
                    Additional note <span className="text-stone-500">(optional)</span>
                  </label>
                  <input
                    id="appointment_preference"
                    name="appointment_preference"
                    type="text"
                    className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="e.g. need interpretation in Korean"
                  />
                </div>
              </div>
            )}
            {preferredContact === "instagram" && (
              <div className="pl-6 border-l-2 border-emerald-200 dark:border-emerald-800 ml-1">
                <label htmlFor="instagram_handle" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Your Instagram handle <span className="text-red-500">*</span>
                </label>
                <input
                  id="instagram_handle"
                  name="instagram_handle"
                  type="text"
                  required
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900 px-4 py-2 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                  placeholder="@username"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={
              status === "sending" ||
              (preferredContact === "zoom" && (!appointmentDate || !appointmentTimeSlot)) ||
              (preferredContact === "instagram" && !instagramHandle.trim())
            }
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-400 dark:disabled:bg-stone-600 disabled:cursor-not-allowed text-white font-medium py-3 transition-colors"
          >
            {status === "sending" ? "Sending…" : "Submit request"}
          </button>
        </form>
      </main>
    </div>
  );
}
