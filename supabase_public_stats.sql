-- ============================================================
-- Public homepage stats — secure aggregate function
-- ============================================================
-- The public homepage runs as the `anon` role. RLS hides the
-- `profiles` table from anon (so names/emails/phones stay private),
-- which means the Students / Volunteer Hours totals come back as 0.
--
-- This SECURITY DEFINER function returns ONLY the three aggregate
-- numbers (no personal data), bypassing RLS safely, and is callable
-- by anon. Run this once in: Supabase Dashboard > SQL Editor.
-- ============================================================

create or replace function public.get_public_stats()
returns table (students bigint, programs bigint, hours bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*)                       from profiles where role = 'student'),
    (select count(*)                       from programs where status = 'approved'),
    (select coalesce(sum(volunteer_hours), 0) from profiles);
$$;

grant execute on function public.get_public_stats() to anon, authenticated;
