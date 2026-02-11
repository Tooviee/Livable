import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function checkAuth(request: NextRequest): boolean {
  const secret =
    request.headers.get("x-admin-secret") ?? request.nextUrl.searchParams.get("secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

export async function GET(
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
  const { data, error } = await supabaseAdmin
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
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
  const body = await request.json().catch(() => ({}));
  const updates: { status?: string; internal_notes?: string | null; updated_at?: string } = {};
  if (["new", "in_progress", "resolved", "closed"].includes(body.status)) {
    updates.status = body.status;
  }
  if (typeof body.internal_notes === "string") {
    updates.internal_notes = body.internal_notes || null;
  }
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No valid updates." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase update error:", error);
    return NextResponse.json({ error: "Failed to update request." }, { status: 500 });
  }
  return NextResponse.json(data);
}
