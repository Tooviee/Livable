import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { sendConfirmationEmail } from "@/lib/email";
import { notifyDiscordNewRequest } from "@/lib/discord";
import type { Database } from "@/types/database";

type RequestInsert = Database["public"]["Tables"]["requests"]["Insert"];

function validate(body: unknown): { name: string; email: string; phone: string | null; language: string; category: string; message: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim()) return null;
  if (typeof b.email !== "string" || !b.email.trim()) return null;
  if (typeof b.language !== "string" || !b.language.trim()) return null;
  if (typeof b.category !== "string" || !b.category.trim()) return null;
  if (typeof b.message !== "string" || !b.message.trim()) return null;
  const phone = b.phone == null ? null : typeof b.phone === "string" ? b.phone.trim() || null : null;
  return {
    name: b.name.trim(),
    email: b.email.trim(),
    phone,
    language: b.language.trim(),
    category: b.category.trim(),
    message: b.message.trim(),
  };
}

export async function POST(request: NextRequest) {
  const parsed = validate(await request.json().catch(() => null));
  if (!parsed) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Use service role so insert always works (server validates input; no anon RLS needed).
  const insertPayload: RequestInsert = {
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    language: parsed.language,
    category: parsed.category,
    message: parsed.message,
    status: "new",
  };
  const { data, error } = supabaseAdmin
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

  const row = data as { id: string; created_at: string } | null;
  const requestId = row?.id ?? "unknown";
  const requestDate = row?.created_at
    ? new Date(row.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })
    : "";

  await sendConfirmationEmail({
    to: parsed.email,
    name: parsed.name,
    requestId,
    requestDate,
  });

  notifyDiscordNewRequest({
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    category: parsed.category,
    message: parsed.message,
    requestId,
  }).catch(() => {});

  return NextResponse.json({ id: requestId, ok: true });
}
