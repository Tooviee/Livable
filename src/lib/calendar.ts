import { getAppointmentSlotLabel } from "@/lib/appointment-slots";

/** Appointment times are in Asia/Seoul (KST = UTC+9). */
const APPOINTMENT_TZ_OFFSET_HOURS = 9;

/** Parse slot "09:00-10:00" to ["09:00", "10:00"]. */
function parseSlot(slotValue: string): [string, string] {
  const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(slotValue.trim());
  if (!match) return ["09:00", "10:00"];
  return [match[1], match[2]];
}

/** Date YYYY-MM-DD + time HH:mm in KST -> UTC Date. */
function localToUtc(dateStr: string, timeStr: string, tzOffsetHours: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - tzOffsetHours, mm ?? 0, 0));
}

/** Format Date as YYYYMMDDTHHmmssZ for ICS/Google. */
function toIsoUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${day}T${h}${mi}${s}Z`;
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcsBlob(
  title: string,
  description: string,
  dateStr: string,
  slotValue: string,
  tzOffsetHours: number = APPOINTMENT_TZ_OFFSET_HOURS
): Blob {
  const [startTime, endTime] = parseSlot(slotValue);
  const start = localToUtc(dateStr, startTime, tzOffsetHours);
  const end = localToUtc(dateStr, endTime, tzOffsetHours);
  const now = new Date();
  const uid = `livable-${dateStr}-${slotValue}-${now.getTime()}@livable`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Livable//Request//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIsoUtc(now)}`,
    `DTSTART:${toIsoUtc(start)}`,
    `DTEND:${toIsoUtc(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Blob([ics], { type: "text/calendar;charset=utf-8" });
}

export function buildGoogleCalendarUrl(
  title: string,
  description: string,
  dateStr: string,
  slotValue: string,
  tzOffsetHours: number = APPOINTMENT_TZ_OFFSET_HOURS
): string {
  const [startTime, endTime] = parseSlot(slotValue);
  const start = localToUtc(dateStr, startTime, tzOffsetHours);
  const end = localToUtc(dateStr, endTime, tzOffsetHours);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toIsoUtc(start)}/${toIsoUtc(end)}`,
    details: description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs(blob: Blob, filename: string = "livable-appointment.ics"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build event title and description for Livable Zoom appointment. */
export function livableEventStrings(
  slotLabel: string,
  categoryLabel: string,
  messageSnippet?: string
): { title: string; description: string } {
  const title = `Livable — ${categoryLabel} (${slotLabel})`;
  const desc = [
    "Virtual appointment with Livable (Zoom).",
    messageSnippet ? `Request: ${messageSnippet}` : "",
    "Check your email for the Zoom link.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { title, description: desc };
}

export { getAppointmentSlotLabel };
