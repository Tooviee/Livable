-- Run this in your Supabase project: SQL Editor → New query → paste and run

-- 1) Create table if not exists (idempotent)
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  language text not null,
  category text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'closed')),
  internal_notes text,
  wants_appointment boolean not null default false,
  appointment_preference text,
  appointment_date date,
  appointment_time_slot text,
  zoom_link text,
  zoom_meeting_id text,
  preferred_contact text not null default 'zoom' check (preferred_contact in ('zoom', 'email', 'instagram')),
  instagram_handle text,
  reschedule_token text unique
);

comment on table public.requests is 'Help requests from foreigners in Korea';

-- 2) Enable RLS
alter table public.requests enable row level security;

-- 3) Drop potentially conflicting or duplicate policies (safe to run even if they don't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow anonymous insert' AND polrelid = 'public.requests'::regclass) THEN
    EXECUTE 'DROP POLICY "Allow anonymous insert" ON public.requests';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow anon insert' AND polrelid = 'public.requests'::regclass) THEN
    EXECUTE 'DROP POLICY "Allow anon insert" ON public.requests';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow anon select' AND polrelid = 'public.requests'::regclass) THEN
    EXECUTE 'DROP POLICY "Allow anon select" ON public.requests';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow anon update' AND polrelid = 'public.requests'::regclass) THEN
    EXECUTE 'DROP POLICY "Allow anon update" ON public.requests';
  END IF;
END$$;

-- 4) Recommended policies:
-- 4a) Allow anon role to insert (form submissions use the anon key → anon role)
DROP POLICY IF EXISTS "anon_insert" ON public.requests;
CREATE POLICY "anon_insert" ON public.requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 4b) Allow admins (via JWT claim "role" = 'admin') full access (SELECT/INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "admin_all_role_claim" ON public.requests;
CREATE POLICY "admin_all_role_claim" ON public.requests
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- 4c) service_role bypasses RLS automatically; this policy is optional (for clarity).
DROP POLICY IF EXISTS "service_role_all" ON public.requests;
CREATE POLICY "service_role_all" ON public.requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5) Add virtual appointment columns (run if table already existed before this was added)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'wants_appointment') THEN
    ALTER TABLE public.requests ADD COLUMN wants_appointment boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'appointment_preference') THEN
    ALTER TABLE public.requests ADD COLUMN appointment_preference text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'zoom_link') THEN
    ALTER TABLE public.requests ADD COLUMN zoom_link text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'appointment_date') THEN
    ALTER TABLE public.requests ADD COLUMN appointment_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'appointment_time_slot') THEN
    ALTER TABLE public.requests ADD COLUMN appointment_time_slot text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'preferred_contact') THEN
    ALTER TABLE public.requests ADD COLUMN preferred_contact text NOT NULL DEFAULT 'zoom';
    ALTER TABLE public.requests ADD CONSTRAINT requests_preferred_contact_check CHECK (preferred_contact IN ('zoom', 'email', 'instagram'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'instagram_handle') THEN
    ALTER TABLE public.requests ADD COLUMN instagram_handle text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'reschedule_token') THEN
    ALTER TABLE public.requests ADD COLUMN reschedule_token text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'zoom_meeting_id') THEN
    ALTER TABLE public.requests ADD COLUMN zoom_meeting_id text;
  END IF;
END$$;

-- 5b) One Zoom slot per date+time: no two active requests (new/in_progress) can have the same appointment_date + appointment_time_slot
DROP INDEX IF EXISTS public.requests_one_booking_per_slot;
CREATE UNIQUE INDEX requests_one_booking_per_slot ON public.requests (appointment_date, appointment_time_slot)
  WHERE wants_appointment = true AND status IN ('new', 'in_progress');

-- 6) Verify: list policies for this table (run this to confirm)
SELECT
  c.relname AS table_name,
  p.polname AS policy_name,
  p.polcmd AS command,
  pg_get_expr(p.polqual, p.polrelid) AS using_clause,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_clause,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND c.relname = 'requests'
ORDER BY p.polname;
