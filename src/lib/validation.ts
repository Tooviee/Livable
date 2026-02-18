/**
 * Shared validation and security limits for request data.
 * Keeps stored data bounded and prevents abuse.
 */

export const LIMITS = {
  name: 200,
  email: 320,
  phone: 50,
  language: 50,
  category: 100,
  message: 10_000,
  internal_notes: 5_000,
  appointment_preference: 500,
  zoom_link: 2_000,
  appointment_time_slot: 20,
  instagram_handle: 100,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEmail(s: string): boolean {
  return s.length <= LIMITS.email && EMAIL_REGEX.test(s);
}

export function isValidUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

export function trimToMax(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(s: string): boolean {
  if (!DATE_ONLY_REGEX.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isDateTodayOrFuture(dateStr: string): boolean {
  const todayUtc = new Date();
  const todayStr = todayUtc.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  return dateStr >= todayStr;
}

export type PreferredContact = "zoom" | "email" | "instagram";

export type ParsedRequest = {
  name: string;
  email: string;
  phone: string | null;
  language: string;
  category: string;
  message: string;
  wants_appointment: boolean;
  appointment_preference: string | null;
  appointment_date: string | null;
  appointment_time_slot: string | null;
  preferred_contact: PreferredContact;
  instagram_handle: string | null;
};

export function validateLengths(
  parsed: ParsedRequest,
  options: { isValidAppointmentSlot: (v: string) => boolean }
): { ok: true; data: ParsedRequest } | { ok: false; error: string } {
  if (parsed.name.length > LIMITS.name) {
    return { ok: false, error: `Name must be ${LIMITS.name} characters or less.` };
  }
  if (!isValidEmail(parsed.email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (parsed.phone && parsed.phone.length > LIMITS.phone) {
    return { ok: false, error: `Phone must be ${LIMITS.phone} characters or less.` };
  }
  if (parsed.language.length > LIMITS.language) {
    return { ok: false, error: `Language must be ${LIMITS.language} characters or less.` };
  }
  if (parsed.category.length > LIMITS.category) {
    return { ok: false, error: `Category must be ${LIMITS.category} characters or less.` };
  }
  if (parsed.message.length > LIMITS.message) {
    return { ok: false, error: `Message must be ${LIMITS.message} characters or less.` };
  }
  if (parsed.appointment_preference && parsed.appointment_preference.length > LIMITS.appointment_preference) {
    return { ok: false, error: `Preferred time must be ${LIMITS.appointment_preference} characters or less.` };
  }
  if (parsed.instagram_handle && parsed.instagram_handle.length > LIMITS.instagram_handle) {
    return { ok: false, error: `Instagram handle must be ${LIMITS.instagram_handle} characters or less.` };
  }
  if (parsed.wants_appointment) {
    if (!parsed.appointment_date?.trim()) {
      return { ok: false, error: "Please select a date for your appointment." };
    }
    if (!isValidDateString(parsed.appointment_date.trim())) {
      return { ok: false, error: "Please enter a valid appointment date." };
    }
    if (!isDateTodayOrFuture(parsed.appointment_date.trim())) {
      return { ok: false, error: "Appointment date must be today or a future date." };
    }
    if (!parsed.appointment_time_slot?.trim()) {
      return { ok: false, error: "Please select a time slot for your appointment." };
    }
    if (!options.isValidAppointmentSlot(parsed.appointment_time_slot.trim())) {
      return { ok: false, error: "Please select a valid time slot." };
    }
  }
  return { ok: true, data: parsed };
}
