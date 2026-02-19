import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { sendZoomLinkEmail } from "@/lib/email";
import { notifyDiscordZoomLinkChange } from "@/lib/discord";
import { getZoomAccessToken } from "@/lib/zoom";
import { isValidUuid } from "@/lib/validation";
import { LIMITS } from "@/lib/validation";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const ZOOM_USER_ID = process.env.ZOOM_USER_ID || "me";
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Seoul";

function checkAuth(request: NextRequest): boolean {
  const secret = request.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && !!secret && secret === ADMIN_SECRET;
}

/**
 * Parse slot value "09:00-10:00" to get start time "09:00" and duration in minutes (60).
 */
function parseSlot(slot: string): { startTime: string; durationMinutes: number } {
  const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(slot.trim());
  if (!match) return { startTime: "09:00", durationMinutes: 60 };
  const [, start, end] = match;
  const startM = parseInt(start.slice(0, 2), 10) * 60 + parseInt(start.slice(3), 10);
  const endM = parseInt(end.slice(0, 2), 10) * 60 + parseInt(end.slice(3), 10);
  const durationMinutes = Math.max(15, Math.min(120, (endM - startM) || 60));
  return { startTime: start, durationMinutes };
}

/**
 * Build Zoom start_time in ISO format for the given date and slot (timezone applied for display; Zoom accepts local time + timezone).
 * Using format: 2025-02-20T09:00:00 with timezone sent separately in the API.
 */
function buildStartTime(appointmentDate: string, slot: string): string {
  const { startTime } = parseSlot(slot);
  return `${appointmentDate}T${startTime}:00`;
}

/**
 * Create a Zoom meeting and return join_url (one-click when possible), meeting ID, and passcode.
 */
async function createZoomMeeting(params: {
  accessToken: string;
  topic: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
}): Promise<{ join_url: string; meetingId?: string; passcode?: string }> {
  const url = `https://api.zoom.us/v2/users/${encodeURIComponent(ZOOM_USER_ID)}/meetings`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: params.topic,
      type: 2,
      start_time: params.startTime,
      duration: params.durationMinutes,
      timezone: params.timezone,
      settings: {
        join_before_host: true,
        waiting_room: false,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Zoom create meeting error:", res.status, text);
    throw new Error("Zoom could not create the meeting.");
  }
  const data = (await res.json()) as {
    join_url?: string;
    id?: number;
    password?: string;
    encrypted_password?: string;
  };
  if (!data.join_url) throw new Error("Zoom did not return a join URL.");

  let joinUrl = data.join_url;
  const meetingId = data.id != null ? String(data.id) : undefined;
  const plainPasscode = data.password ?? "";
  const pwdForUrl = data.encrypted_password ?? data.password ?? "";

  // Ensure one-click join: if Zoom didn't embed the passcode in the URL, append it so users aren't prompted.
  if (pwdForUrl && !joinUrl.includes("pwd=")) {
    const separator = joinUrl.includes("?") ? "&" : "?";
    joinUrl = `${joinUrl}${separator}pwd=${encodeURIComponent(pwdForUrl)}`;
  }

  return {
    join_url: joinUrl,
    meetingId,
    passcode: plainPasscode || undefined,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY required." },
      { status: 500 }
    );
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid request ID." }, { status: 400 });
  }

  const { data: reqRow, error: fetchError } = await supabaseAdmin
    .from("requests")
    .select("id, wants_appointment, appointment_date, appointment_time_slot, zoom_link, name, email, reschedule_token")
    .eq("id", id)
    .single();

  if (fetchError || !reqRow) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const row = reqRow as {
    wants_appointment: boolean;
    appointment_date: string | null;
    appointment_time_slot: string | null;
    zoom_link: string | null;
    name: string;
    email: string;
    reschedule_token: string | null;
  };

  if (!row.wants_appointment || !row.appointment_date || !row.appointment_time_slot) {
    return NextResponse.json(
      { error: "This request does not have a date and time slot for an appointment." },
      { status: 400 }
    );
  }

  if (row.zoom_link?.trim()) {
    return NextResponse.json(
      { error: "This request already has a Zoom link. Edit or clear it first." },
      { status: 400 }
    );
  }

  let joinUrl: string;
  let meetingId: string | undefined;
  let passcode: string | undefined;
  try {
    const accessToken = await getZoomAccessToken();
    const startTime = buildStartTime(row.appointment_date, row.appointment_time_slot);
    const { durationMinutes } = parseSlot(row.appointment_time_slot);
    const topic = `Livable — ${row.name}`;
    const result = await createZoomMeeting({
      accessToken,
      topic,
      startTime,
      durationMinutes,
      timezone: APP_TIMEZONE,
    });
    joinUrl = result.join_url;
    meetingId = result.meetingId;
    passcode = result.passcode;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create Zoom meeting.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const trimmedLink = joinUrl.slice(0, LIMITS.zoom_link);
  const updatePayload: { zoom_link: string; zoom_meeting_id: string | null; updated_at: string } = {
    zoom_link: trimmedLink,
    zoom_meeting_id: meetingId ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabaseAdmin
    .from("requests")
    .update(updatePayload as never)
    .eq("id", id);

  if (updateError) {
    console.error("Supabase update error:", updateError);
    return NextResponse.json(
      { error: "Zoom meeting was created but saving the link failed." },
      { status: 500 }
    );
  }

  let rescheduleToken = row.reschedule_token;
  if (!rescheduleToken) {
    rescheduleToken = randomUUID();
    await supabaseAdmin
      .from("requests")
      .update({ reschedule_token: rescheduleToken, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
  }
  const baseUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
  const rescheduleLink = `${baseUrl}/reschedule?token=${rescheduleToken}`;

  await sendZoomLinkEmail({
    to: row.email,
    name: row.name,
    zoomLink: trimmedLink,
    appointmentDate: row.appointment_date ?? undefined,
    appointmentTimeSlot: row.appointment_time_slot ?? undefined,
    rescheduleLink,
    meetingId,
    passcode,
  });

  notifyDiscordZoomLinkChange({
    requestId: id,
    name: row.name,
    email: row.email,
    zoomLink: trimmedLink,
    kind: "created",
  }).catch((err) => console.error("[Discord] Zoom link notification failed:", err));

  return NextResponse.json({ ok: true, zoom_link: trimmedLink });
}
