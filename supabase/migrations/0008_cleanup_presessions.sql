-- Migration 0008: delete any sessions created before the programme start date
-- (June 30, 2026). This removes orphaned rows from early DB runs that were
-- not cleared by migration 0007 (which only deleted starts_at >= now()).
-- Safe to run multiple times; idempotent.
-- Run in Supabase SQL editor after 0007.

delete from public.sessions
  where starts_at < '2026-06-30T04:00:00Z';  -- Jun 30 00:00 EDT = 04:00 UTC
