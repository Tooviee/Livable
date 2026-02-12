import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!ADMIN_SECRET || !secret || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY required for admin." },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase list error:", error);
    return NextResponse.json({ error: "Failed to load requests." }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}
