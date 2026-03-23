import { NextRequest, NextResponse } from "next/server";
import { sendDiscordTestMessage } from "@/lib/discord";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!ADMIN_SECRET || !secret || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDiscordTestMessage();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Discord test failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
