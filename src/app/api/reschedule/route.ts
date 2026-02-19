import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendAppointmentChangedEmail } from "@/lib/email";
import { notifyDiscordReschedule } from "@/lib/discord";
import { isValidAppointmentSlot } from "@/lib/appointment-slots";
import { LIMITS } from "@/lib/validation";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(s: string): boolean {
  if (!DATE_ONLY_REGEX.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isDateTodayOrFuture(dateStr: string): boolean {
  const todayUtc = new Date();
  const todayStr = todayUtc.toISOString().slice(0, 10);
  return dateStr >= todayStr;
}

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  const token = request.nextUrl.searchParams.get("token");
  if (!token?.trim()) {
    return NextResponse.json({ error: "Invalid or missing link." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .select("id, name, appointment_date, appointment_time_slot, wants_appointment")
    .eq("reschedule_token", token.trim())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }

  const row = data as {
    id: string;
    name: string;
    appointment_date: string | null;
    appointment_time_slot: string | null;
    wants_appointment: boolean;
  };

  if (!row.wants_appointment || !row.appointment_date || !row.appointment_time_slot) {
    return NextResponse.json({ error: "This request does not have an appointment to change." }, { status: 400 });
  }

  return NextResponse.json({
    name: row.name,
    appointment_date: row.appointment_date,
    appointment_time_slot: row.appointment_time_slot,
  });
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  let body: { token?: string; appointment_date?: string; appointment_time_slot?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const appointment_date = typeof body.appointment_date === "string" ? body.appointment_date.trim().slice(0, 10) : "";
  const appointment_time_slot =
    typeof body.appointment_time_slot === "string"
      ? body.appointment_time_slot.trim().slice(0, LIMITS.appointment_time_slot)
      : "";

  if (!token) {
    return NextResponse.json({ error: "Invalid or missing link." }, { status: 400 });
  }
  if (!appointment_date || !isValidDateString(appointment_date)) {
    return NextResponse.json({ error: "Please select a valid date." }, { status: 400 });
  }
  if (!isDateTodayOrFuture(appointment_date)) {
    return NextResponse.json({ error: "Appointment date must be today or a future date." }, { status: 400 });
  }
  if (!appointment_time_slot || !isValidAppointmentSlot(appointment_time_slot)) {
    return NextResponse.json({ error: "Please select a valid time slot." }, { status: 400 });
  }

  const { data: reqRow, error: fetchError } = await supabaseAdmin
    .from("requests")
    .select("id, email, name, appointment_date, appointment_time_slot, wants_appointment")
    .eq("reschedule_token", token)
    .single();

  if (fetchError || !reqRow) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }

  const row = reqRow as {
    id: string;
    email: string;
    name: string;
    appointment_date: string | null;
    appointment_time_slot: string | null;
    wants_appointment: boolean;
  };

  if (!row.wants_appointment) {
    return NextResponse.json({ error: "This request does not have an appointment to change." }, { status: 400 });
  }

  // Same slot as current: allow (no-op) but still confirm
  if (row.appointment_date === appointment_date && row.appointment_time_slot === appointment_time_slot) {
    return NextResponse.json({
      ok: true,
      message: "Your appointment is already set for this date and time.",
    });
  }

  // Check slot not taken by another active request (excluding this one)
  const { data: existing } = await supabaseAdmin
    .from("requests")
    .select("id")
    .eq("wants_appointment", true)
    .eq("appointment_date", appointment_date)
    .eq("appointment_time_slot", appointment_time_slot)
    .in("status", ["new", "in_progress"])
    .neq("id", row.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This date and time slot is no longer available. Please choose another." },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("requests")
    .update({
      appointment_date: appointment_date,
      appointment_time_slot: appointment_time_slot,
      zoom_link: null,
      zoom_meeting_id: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", row.id);

  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json(
        { error: "This date and time slot is no longer available. Please choose another." },
        { status: 409 }
      );
    }
    console.error("Reschedule update error:", updateError);
    return NextResponse.json({ error: "Failed to update appointment." }, { status: 500 });
  }

  await sendAppointmentChangedEmail({
    to: row.email,
    name: row.name,
    appointmentDate: appointment_date,
    appointmentTimeSlot: appointment_time_slot,
  });

  notifyDiscordReschedule({
    requestId: row.id,
    name: row.name,
    email: row.email,
    newDate: appointment_date,
    newTimeSlot: appointment_time_slot,
    oldDate: row.appointment_date ?? undefined,
    oldTimeSlot: row.appointment_time_slot ?? undefined,
  }).catch((err) => console.error("[Discord] Reschedule notification failed:", err));

  return NextResponse.json({ ok: true, message: "Your appointment has been changed. Check your email for confirmation." });
}
