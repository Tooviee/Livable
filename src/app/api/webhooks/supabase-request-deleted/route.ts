import { NextRequest, NextResponse } from "next/server";
import { deleteZoomMeeting } from "@/lib/zoom";

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;

/**
 * Called when a row is deleted from public.requests (e.g. via Supabase dashboard or SQL).
 * Cancels the Zoom meeting if the request had zoom_meeting_id set.
 * Configure in Supabase: Database → Webhooks → Create hook (DELETE on public.requests).
 * Set HTTP header "x-webhook-secret" to match SUPABASE_WEBHOOK_SECRET in .env.
 */
export async function POST(request: NextRequest) {
  if (WEBHOOK_SECRET) {
    const secret =
      request.headers.get("x-webhook-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.nextUrl.searchParams.get("secret");
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { type?: string; table?: string; schema?: string; old_record?: { zoom_meeting_id?: string | null } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type !== "DELETE" || body.table !== "requests" || body.schema !== "public") {
    return NextResponse.json({ ok: true, message: "Ignored" });
  }

  const oldRecord = body.old_record;
  const meetingId = oldRecord?.zoom_meeting_id;
  if (!meetingId || typeof meetingId !== "string" || !meetingId.trim()) {
    return NextResponse.json({ ok: true, message: "No Zoom meeting to cancel" });
  }

  const result = await deleteZoomMeeting(meetingId.trim());
  if (!result.ok) {
    console.error("[webhook] Zoom cancel failed for meeting", meetingId, result.error);
    return NextResponse.json(
      { ok: false, error: "Zoom meeting could not be cancelled" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Zoom meeting cancelled" });
}
