import { supabase, rpc } from "./supabase";
import type { Profile, Seat, SessionRow } from "./database.types";

// Ensures upcoming sessions exist as concrete rows. Safe to call on every page load.
// start_from (YYYY-MM-DD) pins the earliest date sessions are created; pass the
// programme start date so sessions aren't created for weeks before the first event.
export async function ensureSessionsMaterialized(weeksAhead = 20, startFrom?: string) {
  try {
    await rpc("ensure_sessions_materialized", {
      weeks_ahead: weeksAhead,
      ...(startFrom ? { start_from: startFrom } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("ensure_sessions_materialized failed:", msg);
  }
}

// The next N upcoming sessions in chronological order.
export async function fetchNextSessions(n: number): Promise<SessionRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .gte("starts_at", now)
    .eq("status", "open")
    .order("starts_at", { ascending: true })
    .limit(n);
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

// All sessions whose starts_at falls within [from, to] (ISO strings).
export async function fetchSessionsInRange(from: string, to: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .eq("status", "open")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

export async function fetchSessionWithSeats(sessionId: string): Promise<{
  session: SessionRow;
  seats: Seat[];
  profiles: Record<string, Profile>;
}> {
  const [{ data: session, error: sErr }, { data: seats, error: seatsErr }] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", sessionId).single(),
    supabase
      .from("seats")
      .select("*")
      .eq("session_id", sessionId)
      .order("table_number")
      .order("seat_position"),
  ]);
  if (sErr) throw sErr;
  if (seatsErr) throw seatsErr;

  const seatRows = (seats ?? []) as Seat[];
  const profileIds = seatRows.map((s) => s.profile_id).filter((x): x is string => Boolean(x));
  let profiles: Profile[] = [];
  if (profileIds.length > 0) {
    const { data, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .in("id", profileIds);
    if (pErr) throw pErr;
    profiles = (data ?? []) as Profile[];
  }

  const profileMap: Record<string, Profile> = {};
  for (const p of profiles) profileMap[p.id] = p;

  return { session: session as SessionRow, seats: seatRows, profiles: profileMap };
}

export async function claimSeat(seatId: string): Promise<Seat> {
  return await rpc("claim_seat", { p_seat_id: seatId });
}

// Release a seat the caller currently holds. The .eq("profile_id", userId)
// filter is a belt-and-suspenders safety against a stale UI calling this
// for someone else's seat — the RLS policy independently enforces that
// only the seat's holder (or an admin) can null the profile_id.
export async function releaseMySeat(seatId: string, userId: string): Promise<void> {
  // supabase-js v2's update() Update-type inference resolves to `never`
  // when the Database generic is supplied. Cast the table handle so the
  // payload type widens; the runtime call is unchanged.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seatsTable = supabase.from("seats") as any;
  const { error } = await seatsTable
    .update({ profile_id: null, reserved_at: null })
    .eq("id", seatId)
    .eq("profile_id", userId);
  if (error) throw error;
}

// Fetch all sessions where the current user holds a seat.
export async function fetchMyReservations(userId: string): Promise<
  Array<{ session: SessionRow; seat: Seat }>
> {
  // Embedded select: each seat row comes back with its session nested.
  const { data, error } = await supabase
    .from("seats")
    .select("*, sessions!inner(*)")
    .eq("profile_id", userId);

  if (error) throw error;

  type Row = Seat & { sessions: SessionRow };
  const rows = (data ?? []) as unknown as Row[];
  return rows
    .map((r) => {
      const { sessions, ...seat } = r;
      return { session: sessions, seat: seat as Seat };
    })
    .sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at));
}

// Name and photo are sourced automatically from the user's Google account
// (via Clerk) — there is no manual profile form. Upsert only touches these
// columns, so any other fields on an existing row are left untouched.
export interface ProfileInput {
  display_name: string;
  photo_url: string | null;
}

export async function upsertMyProfile(userId: string, email: string, input: ProfileInput) {
  const payload = {
    id: userId,
    email,
    display_name: input.display_name,
    photo_url: input.photo_url,
    updated_at: new Date().toISOString(),
  };
  // Cast: supabase-js's generic inference is flaky on upsert() Insert types
  // when the Database generic is supplied. Runtime payload is correct.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("profiles").upsert(payload as any);
  if (error) throw error;
}
