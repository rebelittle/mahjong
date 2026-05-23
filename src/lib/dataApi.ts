import { supabase, rpc } from "./supabase";
import type { Profile, Seat, SessionRow, SessionType, SkillLevel } from "./database.types";

// Ensures upcoming sessions exist as concrete rows. Safe to call on every page load.
export async function ensureSessionsMaterialized(weeksAhead = 14) {
  try {
    await rpc("ensure_sessions_materialized", { weeks_ahead: weeksAhead });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("ensure_sessions_materialized failed:", msg);
  }
}

// The next upcoming session of each type (or null if none).
export async function fetchUpcomingByType(): Promise<Record<SessionType, SessionRow | null>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .gte("starts_at", now)
    .eq("status", "open")
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const byType: Record<SessionType, SessionRow | null> = {
    mommy: null,
    beginner: null,
    experienced: null,
  };
  for (const row of (data ?? []) as SessionRow[]) {
    if (!byType[row.type]) byType[row.type] = row;
  }
  return byType;
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

export interface ProfileInput {
  display_name: string;
  skill_level: SkillLevel | null;
  notes: string | null;
  photo_url: string | null;
}

export async function upsertMyProfile(userId: string, email: string, input: ProfileInput) {
  const payload = {
    id: userId,
    email,
    display_name: input.display_name,
    skill_level: input.skill_level,
    notes: input.notes,
    photo_url: input.photo_url,
    updated_at: new Date().toISOString(),
  };
  // Cast: supabase-js's generic inference is flaky on upsert() Insert types
  // when the Database generic is supplied. Runtime payload is correct.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("profiles").upsert(payload as any);
  if (error) throw error;
}
