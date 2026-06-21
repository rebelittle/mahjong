-- Migration 0011: Add beginner (Tue) and open play (Wed) sessions for Jul 14–29.
-- All times 6:00–8:00 PM EDT (= 22:00–00:00 UTC next day).
-- Seats (20 per session) are auto-created by the generate_seats_after_session_insert trigger.

insert into public.sessions (type, starts_at, ends_at) values
  ('mommy',    '2026-07-14T22:00:00Z', '2026-07-15T00:00:00Z'),
  ('openplay', '2026-07-15T22:00:00Z', '2026-07-16T00:00:00Z'),
  ('mommy',    '2026-07-21T22:00:00Z', '2026-07-22T00:00:00Z'),
  ('openplay', '2026-07-22T22:00:00Z', '2026-07-23T00:00:00Z'),
  ('mommy',    '2026-07-28T22:00:00Z', '2026-07-29T00:00:00Z'),
  ('openplay', '2026-07-29T22:00:00Z', '2026-07-30T00:00:00Z');
