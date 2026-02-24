import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMeetingReminderEmail } from "@/lib/email";

const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Seoul";
const CRON_SECRET = process.env.CRON_SECRET;

/** Slot value "09:00-10:00" -> start "09:00" */
function getSlotStart(slot: string): string {
  const match = /^(\d{2}:\d{2})-\d{2}:\d{2}$/.exec(slot.trim());
  return match ? match[1] : "09:00";
}

/** Get timezone offset in hours for a given date (e.g. Asia/Seoul = 9 at noon UTC). */
function getTimezoneOffsetHours(dateStr: string, timeZone: string): number {
  const ref = new Date(dateStr + "T12:00:00Z");
  const local = ref.toLocaleString("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const h = parseInt(local.slice(0, 2), 10);
  return h - 12;
}

/** Meeting at (appointment_date, slotStart) in timeZone -> UTC timestamp (ms). */
function meetingStartUtc(appointmentDate: string, slotStart: string, timeZone: string): number {
  const [y, m, d] = appointmentDate.split("-").map(Number);
  const [hh, mm] = slotStart.split(":").map(Number);
  const offsetHours = getTimezoneOffsetHours(appointmentDate, timeZone);
  return Date.UTC(y, m - 1, d, hh - offsetHours, mm ?? 0, 0);
}

/**
 * GET /api/cron/meeting-reminders
 * Call this every 10–15 minutes (e.g. Vercel Cron). Sends a reminder email 30 minutes before each Zoom meeting.
 * Secured by CRON_SECRET header: x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "Cron not configured (CRON_SECRET)." }, { status: 501 });
  }
  const secret = request.headers.get("x-cron-secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not available." }, { status: 503 });
  }

  const now = Date.now();
  const windowStart = now + 25 * 60 * 1000; // 25 min from now
  const windowEnd = now + 35 * 60 * 1000;   // 35 min from now (so one 10-min cron catches it)

  const { data: rows, error } = await supabaseAdmin
    .from("requests")
    .select("id, email, name, appointment_date, appointment_time_slot, zoom_link, reschedule_token")
    .eq("wants_appointment", true)
    .not("zoom_link", "is", null)
    .is("reminder_sent_at", null)
    .in("status", ["new", "in_progress"])
    .not("appointment_date", "is", null)
    .not("appointment_time_slot", "is", null);

  if (error) {
    console.error("meeting-reminders fetch error:", error);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }

  const baseUrl = (process.env.APP_URL || request.nextUrl?.origin || "").replace(/\/$/, "");
  const toSend: { id: string; email: string; name: string; appointment_date: string; appointment_time_slot: string; zoom_link: string; rescheduleLink?: string }[] = [];

  for (const row of rows ?? []) {
    const r = row as {
      id: string;
      email: string;
      name: string;
      appointment_date: string | null;
      appointment_time_slot: string | null;
      zoom_link: string | null;
      reschedule_token: string | null;
    };
    if (!r.appointment_date || !r.appointment_time_slot || !r.zoom_link) continue;
    const start = getSlotStart(r.appointment_time_slot);
    const meetingMs = meetingStartUtc(r.appointment_date, start, APP_TIMEZONE);
    if (meetingMs >= windowStart && meetingMs <= windowEnd) {
      toSend.push({
        id: r.id,
        email: r.email,
        name: r.name,
        appointment_date: r.appointment_date,
        appointment_time_slot: r.appointment_time_slot,
        zoom_link: r.zoom_link,
        rescheduleLink: r.reschedule_token && baseUrl
          ? `${baseUrl}/reschedule?token=${r.reschedule_token}`
          : undefined,
      });
    }
  }

  let sent = 0;
  for (const item of toSend) {
    await sendMeetingReminderEmail({
      to: item.email,
      name: item.name,
      zoomLink: item.zoom_link,
      appointmentDate: item.appointment_date,
      appointmentTimeSlot: item.appointment_time_slot,
      rescheduleLink: item.rescheduleLink,
    });
    await supabaseAdmin
      .from("requests")
      .update({ reminder_sent_at: new Date().toISOString() } as never)
      .eq("id", item.id);
    sent++;
  }

  return NextResponse.json({ ok: true, sent, total: toSend.length });
}
