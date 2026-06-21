-- Migration 0010: Crack, Bam, Create! special sessions on Jul 10 & 17.
-- Run in Supabase SQL editor after 0009.

------------------------------------------------------------------------
-- 1. Remove all sessions from July 8 onward (including any regenerated
--    regular sessions that are no longer wanted).
------------------------------------------------------------------------
delete from public.sessions
  where starts_at >= '2026-07-08T04:00:00Z';  -- Jul 8 00:00 EDT = 04:00 UTC

------------------------------------------------------------------------
-- 2. Mark ALL remaining active templates inactive so
--    ensure_sessions_materialized becomes a permanent no-op.
--    The summer schedule is now fully managed via hand-inserted rows.
------------------------------------------------------------------------
update public.session_templates
  set active = false
  where active = true;

------------------------------------------------------------------------
-- 3. Widen type constraints to include 'crack_bam_create'.
------------------------------------------------------------------------
alter table public.session_templates
  drop constraint if exists session_templates_type_check;
alter table public.session_templates
  add constraint session_templates_type_check
  check (type in ('mommy', 'beginner', 'experienced', 'openplay', 'crack_bam_create'));

alter table public.sessions
  drop constraint if exists sessions_type_check;
alter table public.sessions
  add constraint sessions_type_check
  check (type in ('mommy', 'beginner', 'experienced', 'openplay', 'crack_bam_create'));

------------------------------------------------------------------------
-- 4. Insert the two Crack, Bam, Create! sessions.
--    Seats (5 tables × 4 positions = 20 rows) are auto-created by the
--    generate_seats_after_session_insert trigger; only tables 1–2 are
--    shown in the UI (maxTables = 2 on the frontend template).
--    Jul 10 4 pm – 8 pm EDT = 20:00 – 00:00 UTC
--    Jul 17 4 pm – 8 pm EDT = 20:00 – 00:00 UTC
------------------------------------------------------------------------
insert into public.sessions (type, starts_at, ends_at, notes) values
  (
    'crack_bam_create',
    '2026-07-10T20:00:00Z',
    '2026-07-11T00:00:00Z',
    'Summer Style Studio: Hats & Bags — Choose a beach hat or tote and make it completely your own with paint, beads, charms, ribbons, and more!'
  ),
  (
    'crack_bam_create',
    '2026-07-17T20:00:00Z',
    '2026-07-18T00:00:00Z',
    'Kinusaiga Art — Learn the beautiful Japanese art of no-sew fabric collage and create a stunning piece for your home.'
  );
