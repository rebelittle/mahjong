-- Migration 0009: cap all sessions to July 2026; Mommy Mahj is one-time-only.
-- Run in Supabase SQL editor after 0008.

-- 1. Remove every session that starts on or after Aug 1 2026 (midnight Eastern = 04:00 UTC).
delete from public.sessions
  where starts_at >= '2026-08-01T04:00:00Z';

-- 2. Keep only the very first Mommy Mahj session (Jul 1 12:30 PM); delete all
--    recurring Wednesday afternoon slots.
delete from public.sessions
  where type = 'experienced'
    and starts_at != (
      select min(starts_at) from public.sessions where type = 'experienced'
    );

-- 3. Mark the experienced template inactive so ensure_sessions_materialized
--    never auto-generates additional Mommy Mahj sessions.
--    The single Jul 1 session is now a permanent, hand-held fixture.
update public.session_templates
  set active = false
  where type = 'experienced';
