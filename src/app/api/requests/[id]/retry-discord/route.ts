import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyDiscordNewRequest } from "@/lib/discord";
import { isValidUuid, LIMITS } from "@/lib/validation";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function checkAuth(request: NextRequest): boolean {
  const secret = request.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && !!secret && secret === ADMIN_SECRET;
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

  const { data, error } = await supabaseAdmin
    .from("requests")
    .select("id, name, email, phone, category, message, wants_appointment, appointment_preference, appointment_date, appointment_time_slot, preferred_contact, instagram_handle")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const row = data as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    category: string;
    message: string;
    wants_appointment: boolean;
    appointment_preference: string | null;
    appointment_date: string | null;
    appointment_time_slot: string | null;
    preferred_contact: "zoom" | "email" | "instagram" | null;
    instagram_handle: string | null;
  };

  const result = await notifyDiscordNewRequest({
    name: row.name,
    email: row.email,
    phone: row.phone,
    category: row.category,
    message: row.message,
    requestId: row.id,
    wantsAppointment: row.wants_appointment,
    appointmentPreference: row.appointment_preference ?? undefined,
    appointmentDate: row.appointment_date ?? undefined,
    appointmentTimeSlot: row.appointment_time_slot ?? undefined,
    preferredContact: (row.preferred_contact as "zoom" | "email" | "instagram") ?? undefined,
    instagramHandle: row.instagram_handle ?? undefined,
  });

  const statusUpdate = result.ok
    ? { discord_notified_at: new Date().toISOString(), discord_notify_error: null, updated_at: new Date().toISOString() }
    : {
        discord_notified_at: null,
        discord_notify_error: (result.error || "Discord notification failed.").slice(0, LIMITS.internal_notes),
        updated_at: new Date().toISOString(),
      };
  await supabaseAdmin.from("requests").update(statusUpdate as never).eq("id", id);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
