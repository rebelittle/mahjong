-- Migration 0006: retune the first two slots to experienced-player evening sessions.
--
-- The first two weekly slots become Wednesday and Friday, 6:00–8:00 PM, for
-- players who already know the rules. The third slot (experienced, Thu 10–12)
-- is left untouched. Run this in the Supabase SQL editor after 0003/0005.
--
-- Slot identity is still keyed by `type` internally (mommy/beginner/experienced);
-- only the schedule changes here. The user-facing titles/descriptions live in
-- src/data/sessionTemplates.ts.

-- Slot 1 — Wednesday 6–8 PM
update public.session_templates
  set day_of_week = 3, start_time = '18:00', end_time = '20:00'
  where type = 'mommy';

-- Slot 2 — Friday 6–8 PM
update public.session_templates
  set day_of_week = 5, start_time = '18:00', end_time = '20:00'
  where type = 'beginner';

-- Drop already-materialized future sessions for the two retuned slots so they
-- re-materialize at the new times on the next page load. Seats cascade-delete.
-- Safe: no real bookings exist yet (planning stage).
delete from public.sessions
  where starts_at >= now()
    and template_id in (
      select id from public.session_templates where type in ('mommy', 'beginner')
    );
