import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(s: string): boolean {
  if (!DATE_ONLY_REGEX.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * GET /api/appointment-slots?date=YYYY-MM-DD&token=...
 * Returns time slots that are already taken for the given date (active requests only).
 * Optional token: when rescheduling, exclude the request that has this token so the user's current slot stays selectable.
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date")?.trim().slice(0, 10) ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? null;

  if (!date || !isValidDateString(date)) {
    return NextResponse.json({ error: "Valid date (YYYY-MM-DD) is required." }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ taken: [] });
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
    return NextResponse.json({ taken: [] });
  }

  const taken = Array.from(
    new Set(
      (rows ?? [])
        .map((r) => (r as { appointment_time_slot: string | null }).appointment_time_slot)
        .filter((s): s is string => typeof s === "string" && s.length > 0)
    )
  );

  return NextResponse.json({ taken });
}
