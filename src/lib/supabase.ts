import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/** Server-only. Use in API routes for admin actions (list/update requests). Bypasses RLS. */
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
  : null;
