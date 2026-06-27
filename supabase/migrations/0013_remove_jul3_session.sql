-- Migration 0013: Remove the July 3 session entirely (nobody joined — it's the
-- day before the U.S. 250th birthday on Jul 4, 2026).
-- Date-scoped so it removes whatever session sits on Jul 3 EDT regardless of
-- type. Seats cascade-delete with the session.
--   Jul 3 00:00 EDT = Jul 3 04:00 UTC
--   Jul 4 00:00 EDT = Jul 4 04:00 UTC

delete from public.sessions
where starts_at >= '2026-07-03T04:00:00Z'
  and starts_at <  '2026-07-04T04:00:00Z';
