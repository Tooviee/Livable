import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { sendConfirmationEmail } from "@/lib/email";
import { notifyDiscordNewRequest } from "@/lib/discord";
import { validateLengths, trimToMax, LIMITS } from "@/lib/validation";
import { isValidAppointmentSlot } from "@/lib/appointment-slots";
import { checkSubmitRateLimit, getSubmitLimitMessage } from "@/lib/rate-limit";
import type { Database } from "@/types/database";

const MAX_BODY_BYTES = 50_000; // ~50KB

type RequestInsert = Database["public"]["Tables"]["requests"]["Insert"];

type PreferredContact = "zoom" | "email" | "instagram";

type Parsed = {
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

const PREFERRED_CONTACT_VALUES: PreferredContact[] = ["zoom", "email", "instagram"];

function parseBody(body: unknown): Parsed | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim()) return null;
  if (typeof b.email !== "string" || !b.email.trim()) return null;
  if (typeof b.language !== "string" || !b.language.trim()) return null;
  if (typeof b.category !== "string" || !b.category.trim()) return null;
  if (typeof b.message !== "string" || !b.message.trim()) return null;
  const phone = b.phone == null ? null : typeof b.phone === "string" ? b.phone.trim() || null : null;
  const rawContact =
    typeof b.preferred_contact === "string" && PREFERRED_CONTACT_VALUES.includes(b.preferred_contact as PreferredContact)
      ? (b.preferred_contact as PreferredContact)
      : "zoom";
  const wants_appointment = rawContact === "zoom";
  const appointment_preference =
    wants_appointment && typeof b.appointment_preference === "string" && b.appointment_preference.trim()
      ? trimToMax(b.appointment_preference.trim(), LIMITS.appointment_preference)
      : null;
  const appointment_date =
    wants_appointment && typeof b.appointment_date === "string" && b.appointment_date.trim()
      ? b.appointment_date.trim().slice(0, 10)
      : null;
  const appointment_time_slot =
    wants_appointment && typeof b.appointment_time_slot === "string" && b.appointment_time_slot.trim()
      ? b.appointment_time_slot.trim().slice(0, LIMITS.appointment_time_slot)
      : null;
  const instagram_handle =
    rawContact === "instagram" && typeof b.instagram_handle === "string" && b.instagram_handle.trim()
      ? trimToMax(b.instagram_handle.trim(), LIMITS.instagram_handle)
      : null;
  return {
    name: trimToMax(b.name.trim(), LIMITS.name),
    email: b.email.trim().toLowerCase().slice(0, LIMITS.email),
    phone: phone ? trimToMax(phone, LIMITS.phone) : null,
    language: trimToMax(b.language.trim(), LIMITS.language),
    category: trimToMax(b.category.trim(), LIMITS.category),
    message: trimToMax(b.message.trim(), LIMITS.message),
    wants_appointment,
    appointment_preference,
    appointment_date,
    appointment_time_slot,
    preferred_contact: rawContact,
    instagram_handle,
  };
}

function getClientId(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 400 });
  }

  const rawBody = await request.text().catch(() => "");
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const parsed = parseBody(
    (() => {
      try {
        return JSON.parse(rawBody);
      } catch {
        return null;
      }
    })()
  );
  if (!parsed) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validated = validateLengths(parsed, { isValidAppointmentSlot });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const data = validated.data;

  const rate = checkSubmitRateLimit(getClientId(request));
  if (!rate.ok) {
    return NextResponse.json(
      { error: getSubmitLimitMessage(rate.retryAfter) },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  // Prevent double-booking: same date + time slot can only be used by one active request (new or in_progress).
  if (data.wants_appointment && data.appointment_date && data.appointment_time_slot) {
    const client = supabaseAdmin ?? supabase;
    if (client) {
      const { data: existing } = await client
        .from("requests")
        .select("id")
        .eq("wants_appointment", true)
        .eq("appointment_date", data.appointment_date)
        .eq("appointment_time_slot", data.appointment_time_slot)
        .in("status", ["new", "in_progress"])
        .limit(1)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { error: "This date and time slot is no longer available. Please choose another date or time." },
          { status: 409 }
        );
      }
    }
  }

  const rescheduleToken = data.wants_appointment ? randomUUID() : null;

  // Use service role so insert always works (server validates input; no anon RLS needed).
  const insertPayload: RequestInsert = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    language: data.language,
    category: data.category,
    message: data.message,
    status: "new",
    wants_appointment: data.wants_appointment,
    appointment_preference: data.appointment_preference,
    appointment_date: data.appointment_date ?? null,
    appointment_time_slot: data.appointment_time_slot ?? null,
    preferred_contact: data.preferred_contact,
    instagram_handle: data.instagram_handle,
    reschedule_token: rescheduleToken,
  };
  const { data: inserted, error } = supabaseAdmin
    ? await supabaseAdmin.from("requests").insert(insertPayload as never).select("id, created_at").single()
    : await supabase.from("requests").insert(insertPayload as never).select("id, created_at").single();

  if (error) {
    console.error("Supabase insert error:", error);
    // Unique constraint violation: slot was taken by a concurrent request.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This date and time slot is no longer available. Please choose another date or time." },
        { status: 409 }
      );
    }
    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to save request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const row = inserted as { id: string; created_at: string } | null;
  const requestId = row?.id ?? "unknown";
  const requestDate = row?.created_at
    ? new Date(row.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })
    : "";
  const baseUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
  const rescheduleLink =
    data.wants_appointment && rescheduleToken ? `${baseUrl}/reschedule?token=${rescheduleToken}` : undefined;

  await sendConfirmationEmail({
    to: data.email,
    name: data.name,
    requestId,
    requestDate,
    wantsAppointment: data.wants_appointment,
    appointmentPreference: data.appointment_preference ?? undefined,
    appointmentDate: data.appointment_date ?? undefined,
    appointmentTimeSlot: data.appointment_time_slot ?? undefined,
    preferredContact: data.preferred_contact,
    instagramHandle: data.instagram_handle ?? undefined,
    rescheduleLink,
  });

  notifyDiscordNewRequest({
    name: data.name,
    email: data.email,
    phone: data.phone,
    category: data.category,
    message: data.message,
    requestId,
    wantsAppointment: data.wants_appointment,
    appointmentPreference: data.appointment_preference ?? undefined,
    appointmentDate: data.appointment_date ?? undefined,
    appointmentTimeSlot: data.appointment_time_slot ?? undefined,
    preferredContact: data.preferred_contact,
    instagramHandle: data.instagram_handle ?? undefined,
  }).catch((err) => {
    console.error("[Discord] Notification failed:", err);
  });

  return NextResponse.json({ id: requestId, ok: true });
}
