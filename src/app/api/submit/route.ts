import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { sendConfirmationEmail } from "@/lib/email";
import { notifyDiscordNewRequest } from "@/lib/discord";
import { validateLengths, trimToMax, LIMITS } from "@/lib/validation";
import { checkSubmitRateLimit, getSubmitLimitMessage } from "@/lib/rate-limit";
import type { Database } from "@/types/database";

const MAX_BODY_BYTES = 50_000; // ~50KB

type RequestInsert = Database["public"]["Tables"]["requests"]["Insert"];

function parseBody(body: unknown): { name: string; email: string; phone: string | null; language: string; category: string; message: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim()) return null;
  if (typeof b.email !== "string" || !b.email.trim()) return null;
  if (typeof b.language !== "string" || !b.language.trim()) return null;
  if (typeof b.category !== "string" || !b.category.trim()) return null;
  if (typeof b.message !== "string" || !b.message.trim()) return null;
  const phone = b.phone == null ? null : typeof b.phone === "string" ? b.phone.trim() || null : null;
  return {
    name: trimToMax(b.name.trim(), LIMITS.name),
    email: b.email.trim().toLowerCase().slice(0, LIMITS.email),
    phone: phone ? trimToMax(phone, LIMITS.phone) : null,
    language: trimToMax(b.language.trim(), LIMITS.language),
    category: trimToMax(b.category.trim(), LIMITS.category),
    message: trimToMax(b.message.trim(), LIMITS.message),
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

  const validated = validateLengths(parsed);
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

  // Use service role so insert always works (server validates input; no anon RLS needed).
  const insertPayload: RequestInsert = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    language: data.language,
    category: data.category,
    message: data.message,
    status: "new",
  };
  const { data: inserted, error } = supabaseAdmin
    ? await supabaseAdmin.from("requests").insert(insertPayload as never).select("id, created_at").single()
    : await supabase.from("requests").insert(insertPayload as never).select("id, created_at").single();

  if (error) {
    console.error("Supabase insert error:", error);
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

  await sendConfirmationEmail({
    to: data.email,
    name: data.name,
    requestId,
    requestDate,
  });

  notifyDiscordNewRequest({
    name: data.name,
    email: data.email,
    phone: data.phone,
    category: data.category,
    message: data.message,
    requestId,
  }).catch((err) => {
    console.error("[Discord] Notification failed:", err);
  });

  return NextResponse.json({ id: requestId, ok: true });
}
