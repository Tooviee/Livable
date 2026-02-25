import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { APPOINTMENT_TIME_SLOTS } from "@/lib/appointment-slots";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Seoul";

function isValidDateString(s: string): boolean {
  if (!DATE_ONLY_REGEX.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Slot value "09:00-10:00" -> start "09:00" */
function getSlotStart(slot: string): string {
  const match = /^(\d{2}:\d{2})-\d{2}:\d{2}$/.exec(slot.trim());
  return match ? match[1] : "09:00";
}

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

/** Slot start (e.g. "09:00") on date in timeZone -> UTC ms */
function slotStartUtc(appointmentDate: string, slotStart: string, timeZone: string): number {
  const [y, m, d] = appointmentDate.split("-").map(Number);
  const [hh, mm] = slotStart.split(":").map(Number);
  const offsetHours = getTimezoneOffsetHours(appointmentDate, timeZone);
  return Date.UTC(y, m - 1, d, hh - offsetHours, mm ?? 0, 0);
}

/** Slots that are already in the past for the given date (in APP_TIMEZONE) */
function getPastSlotsForDate(dateStr: string): string[] {
  const now = Date.now();
  const past: string[] = [];
  for (const slot of APPOINTMENT_TIME_SLOTS) {
    const start = getSlotStart(slot.value);
    const slotMs = slotStartUtc(dateStr, start, APP_TIMEZONE);
    if (now >= slotMs) past.push(slot.value);
  }
  return past;
}

/**
 * GET /api/appointment-slots?date=YYYY-MM-DD&token=...
 * Returns time slots that are taken and slots that are in the past for the given date.
 * Optional token: when rescheduling, exclude the request that has this token so the user's current slot stays selectable.
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date")?.trim().slice(0, 10) ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? null;

  if (!date || !isValidDateString(date)) {
    return NextResponse.json({ error: "Valid date (YYYY-MM-DD) is required." }, { status: 400 });
  }

  const past = getPastSlotsForDate(date);

  if (!supabaseAdmin) {
    return NextResponse.json({ taken: [], past });
  }

  let excludeRequestId: string | null = null;
  if (token) {
    const { data: reqRow } = await supabaseAdmin
      .from("requests")
      .select("id")
      .eq("reschedule_token", token)
      .single();
    if (reqRow && typeof (reqRow as { id: string }).id === "string") {
      excludeRequestId = (reqRow as { id: string }).id;
    }
  }

  let query = supabaseAdmin
    .from("requests")
    .select("appointment_time_slot")
    .eq("wants_appointment", true)
    .eq("appointment_date", date)
    .in("status", ["new", "in_progress"]);

  if (excludeRequestId) {
    query = query.neq("id", excludeRequestId);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("appointment-slots fetch error:", error);
    return NextResponse.json({ taken: [], past });
  }

  const taken = Array.from(
    new Set(
      (rows ?? [])
        .map((r) => (r as { appointment_time_slot: string | null }).appointment_time_slot)
        .filter((s): s is string => typeof s === "string" && s.length > 0)
    )
  );

  return NextResponse.json({ taken, past });
}
