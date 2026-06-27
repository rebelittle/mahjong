import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import { claimSeat, fetchSessionWithSeats, releaseMySeat } from "../lib/dataApi";
import { formatSessionDate, initialsOf } from "../lib/utils";
import { visibleTablesFromSeats } from "../lib/seatLogic";
import type { Profile, Seat, SeatPosition, SessionRow } from "../lib/database.types";
import { SESSION_AMENITIES, SESSION_TEMPLATES } from "../data/sessionTemplates";

const POSITIONS: SeatPosition[] = ["east", "south", "west", "north"];
const TABLE_TILTS: Record<number, number> = { 1: -2, 2: 1.5, 3: -1.5, 4: 2 };
// Felt "play mat" colour per table: 1 pink · 2 blue · 3 red · 4 green.
const TABLE_MATS: Record<number, { base: string; edge: string }> = {
  1: { base: "#EBA6BC", edge: "#D5859F" }, // pink
  2: { base: "#2F6BB0", edge: "#1F5BA8" }, // blue
  3: { base: "#C23A33", edge: "#9E2A24" }, // red
  4: { base: "#3D9262", edge: "#2D7A50" }, // green
};
const TABLE_NAMES: Record<number, string> = { 1: "Pink", 2: "Blue", 3: "Red", 4: "Green" };
const TABLE_NAME_COLORS: Record<number, string> = {
  1: "#B5336E", // pink
  2: "#1F5BA8", // blue
  3: "#B8302A", // red
  4: "#286B47", // green
};
const WIND_GLYPH: Record<SeatPosition, string> = {
  east: "東",
  south: "南",
  west: "西",
  north: "北",
};
const POSITION_LABEL: Record<SeatPosition, string> = {
  east: "East",
  south: "South",
  west: "West",
  north: "North",
};

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [pendingSeatId, setPendingSeatId] = useState<string | null>(null);
  const [recentlyClaimedId, setRecentlyClaimedId] = useState<string | null>(null);
  const seatsRef = useRef<Seat[]>([]);
  seatsRef.current = seats;

  // Initial load
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchSessionWithSeats(id);
        if (!alive) return;
        setSession(data.session);
        setSeats(data.seats);
        setProfiles(data.profiles);
      } catch (err) {
        if (alive) setErrMsg(err instanceof Error ? err.message : "Failed to load session.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // Realtime: when anyone claims/releases a seat in this session, mirror it locally.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`seats:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "seats", filter: `session_id=eq.${id}` },
        async (payload) => {
          const next = payload.new as unknown as Seat;
          setSeats((prev) => prev.map((s) => (s.id === next.id ? next : s)));
          // Fetch newly-seated profile if we don't have them cached
          if (next.profile_id && !profiles[next.profile_id]) {
            const { data } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", next.profile_id)
              .maybeSingle();
            if (data) {
              const p = data as unknown as Profile;
              setProfiles((cache) => ({ ...cache, [p.id]: p }));
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, profiles]);

  const presentation = useMemo(
    () => session ? SESSION_TEMPLATES.find((t) => t.type === session.type) : null,
    [session],
  );

  const mySeat = useMemo(
    () => (user ? seats.find((s) => s.profile_id === user.id) ?? null : null),
    [seats, user],
  );

  const takenCount = useMemo(() => seats.filter((s) => s.profile_id).length, [seats]);

  const onClaim = useCallback(async (seatId: string) => {
    if (!user) {
      // Redirect to login but preserve return
      window.location.hash = "#/login";
      return;
    }
    setPendingSeatId(seatId);
    setErrMsg("");
    try {
      const updated = await claimSeat(seatId);
      // Optimistically reflect; realtime will also fire
      setSeats((prev) =>
        prev.map((s) => {
          if (s.id === updated.id) return updated;
          // Release my old seat if it was in this session
          if (s.profile_id === user.id && s.id !== updated.id) {
            return { ...s, profile_id: null, reserved_at: null };
          }
          return s;
        }),
      );
      setRecentlyClaimedId(seatId);
      setTimeout(() => setRecentlyClaimedId(null), 1200);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Couldn't claim that seat.");
    } finally {
      setPendingSeatId(null);
    }
  }, [user]);

  const [releasing, setReleasing] = useState(false);
  const onRelease = useCallback(async (seatId: string) => {
    if (!user) return;
    setReleasing(true);
    setErrMsg("");
    try {
      await releaseMySeat(seatId, user.id);
      setSeats((prev) =>
        prev.map((s) => (s.id === seatId ? { ...s, profile_id: null, reserved_at: null } : s)),
      );
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Couldn't release that seat.");
    } finally {
      setReleasing(false);
    }
  }, [user]);

  if (loading) {
    return <CenteredSpinner />;
  }
  if (!session || !presentation) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-14 sm:px-6">
        <div className="card p-8 text-center">
          <h1 className="text-2xl">Session not found</h1>
          <p className="mt-2 text-fox-ink/70">It may have been cancelled or rescheduled.</p>
          <Link to="/" className="btn-primary mt-5">Back to sessions</Link>
        </div>
      </main>
    );
  }

  const d = formatSessionDate(session.starts_at);
  const end = formatSessionDate(session.ends_at);

  // Bucket seats by table_number → 1..4
  const tables: Record<number, Seat[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const s of seats) {
    if (tables[s.table_number]) tables[s.table_number].push(s);
  }

  // Which tables are visible + the capacity, derived from the real seat rows so
  // a session capped to fewer tables (seats deleted) reports the smaller count.
  const visibleTables = visibleTablesFromSeats(
    seats,
    presentation.maxTables ?? 4,
    presentation.fixedTables,
  );
  const visibleCapacity = visibleTables.size * 4;
  const isFull = visibleCapacity > 0 && takenCount >= visibleCapacity;

  return (
    <main className="mx-auto max-w-6xl px-3 pb-32 pt-8 sm:px-6">
      {/* ───── Header ───── */}
      <section className="card mb-8 overflow-hidden">
        <div className="grid gap-5 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8">
          <SessionGlyph glyph={presentation.glyph} color={presentation.glyphColor} />
          <div>
            <p className="pill" style={{ color: presentation.glyphColor }}>{presentation.tagline}</p>
            <h1 className="mt-2 text-3xl sm:text-[2.4rem] leading-tight">{presentation.title}</h1>
            <p className="mt-1 text-fox-ink/75">
              <span className="font-medium text-fox-navy-700">{d.day}, {d.date}</span>
              {" · "}
              {d.time} – {end.time}
            </p>
            {session.notes && (
              <p className="mt-2 text-sm text-fox-ink/70">{session.notes}</p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <div className="font-display text-4xl text-fox-navy-700">
              {takenCount}<span className="text-fox-ink/30">/{visibleCapacity}</span>
            </div>
            {isFull ? (
              <span className="mt-1 inline-block rounded-full bg-tile-red/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-tile-red">
                Full
              </span>
            ) : (
              <p className="text-[11px] uppercase tracking-[0.22em] text-fox-ink/55">seats taken</p>
            )}
          </div>
        </div>
        {errMsg && (
          <p className="border-t border-tile-red/30 bg-tile-red/5 px-7 py-3 text-sm text-tile-red">
            {errMsg}
          </p>
        )}
      </section>

      {/* ───── The room ───── */}
      <div className="relative">
        <RoomDecoration />

        <div className="relative z-10 grid gap-8 sm:gap-16">
          {[[1], [2, 3], [4]].map((row, i) => {
            const shown = row.filter((n) => visibleTables.has(n));
            if (shown.length === 0) return null;
            return (
              <TableRow key={i} tables={shown} bucketed={tables} render={(n) => (
                <MahjongTable
                  key={n}
                  tableNumber={n}
                  seats={tables[n]}
                  profiles={profiles}
                  currentUserId={user?.id ?? null}
                  onClaim={onClaim}
                  pendingSeatId={pendingSeatId}
                  recentlyClaimedId={recentlyClaimedId}
                  tilt={TABLE_TILTS[n] ?? 0}
                />
              )} />
            );
          })}
        </div>
      </div>

      {/* ───── Price & what's provided (at the end) ───── */}
      <section className="card mt-10 overflow-hidden">
        <div className="grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
          <div className="text-center sm:text-left">
            <p className="font-display text-3xl text-fox-navy-700">
              {presentation.priceLabel ?? "$40 · 2 hours"}
            </p>
            <p className="text-xs uppercase tracking-[0.22em] text-fox-ink/55">per session</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SESSION_AMENITIES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-fox-ink/80">
                <span aria-hidden className="mt-0.5 text-fox-yellow-600">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-fox-cream-200 bg-fox-cream-50/60 px-6 py-2.5 text-center text-xs text-fox-ink/55 sm:px-7">
          Cash or Venmo accepted on arrival
        </div>
      </section>

      {/* ───── Your seat status (bottom bar) ───── */}
      <YourSeatBar
        mySeat={mySeat}
        user={user}
        onRelease={onRelease}
        releasing={releasing}
      />
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   The room layout
   ───────────────────────────────────────────────────────────────────────── */

function TableRow({
  tables,
  bucketed,
  render,
}: {
  tables: number[];
  bucketed: Record<number, Seat[]>;
  render: (n: number) => React.ReactNode;
}) {
  // Only render tables that actually exist in the bucketed map
  const valid = tables.filter((n) => bucketed[n]?.length > 0);
  return (
    <div
      className="grid justify-items-center gap-8 sm:gap-20"
      style={{ gridTemplateColumns: `repeat(${valid.length}, minmax(0, 1fr))` }}
    >
      {valid.map((n) => render(n))}
    </div>
  );
}

function RoomDecoration() {
  // Subtle radial vignette so the room reads as a defined "stage"
  return (
    <div
      aria-hidden
      className="absolute inset-0 -m-6 rounded-[40px]"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(245, 184, 46, 0.06) 0%, rgba(255, 252, 245, 0) 65%)",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   One mahjong table with 4 chairs
   ───────────────────────────────────────────────────────────────────────── */

function MahjongTable({
  tableNumber,
  seats,
  profiles,
  currentUserId,
  onClaim,
  pendingSeatId,
  recentlyClaimedId,
  tilt,
}: {
  tableNumber: number;
  seats: Seat[];
  profiles: Record<string, Profile>;
  currentUserId: string | null;
  onClaim: (seatId: string) => void;
  pendingSeatId: string | null;
  recentlyClaimedId: string | null;
  tilt: number;
}) {
  // Build a position → seat map for stable lookup even if order varies
  const byPos: Partial<Record<SeatPosition, Seat>> = {};
  for (const s of seats) byPos[s.seat_position] = s;

  return (
    <div
      className="relative w-[130px] sm:w-[290px]"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {/* Subtle drop shadow on the floor under the table */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[110px] w-[110px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-2xl sm:h-[260px] sm:w-[260px]"
        style={{ background: "radial-gradient(circle, #2C2A26 0%, transparent 70%)" }}
      />

      {/* The table surface as SVG */}
      <TableTopSvg tableNumber={tableNumber} />

      {/* Chairs absolutely positioned around the table */}
      {POSITIONS.map((pos) => {
        const seat = byPos[pos];
        if (!seat) return null;
        const profile = seat.profile_id ? profiles[seat.profile_id] : null;
        return (
          <Chair
            key={pos}
            profile={profile}
            position={pos}
            isMine={!!currentUserId && seat.profile_id === currentUserId}
            isPending={pendingSeatId === seat.id}
            isRecentlyClaimed={recentlyClaimedId === seat.id}
            onClaim={() => onClaim(seat.id)}
          />
        );
      })}
    </div>
  );
}

function TableTopSvg({ tableNumber }: { tableNumber: number }) {
  // A square table with the four winds 東 南 西 北 at each edge.
  // The table number sits in the centre as a small decorative tile.
  return (
    <svg
      viewBox="0 0 260 260"
      className="block h-auto w-full drop-shadow-[0_8px_18px_rgba(19,41,74,0.18)]"
      aria-hidden
    >
      <defs>
        <linearGradient id={`felt-${tableNumber}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6EBC9" />
          <stop offset="100%" stopColor="#E8D9A6" />
        </linearGradient>
        <radialGradient id={`feltInner-${tableNumber}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF7DE" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#E8D9A6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`matSheen-${tableNumber}`} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <pattern id={`weave-${tableNumber}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 0h4M0 2h4" stroke="#C6B17A" strokeWidth="0.3" opacity="0.25" />
        </pattern>
      </defs>

      {/* Outer wooden frame */}
      <rect x="6" y="6" width="248" height="248" rx="18" fill="#A6760A" />
      <rect x="9" y="9" width="242" height="242" rx="16" fill="#13294A" opacity="0.06" />
      {/* Felt surface */}
      <rect x="14" y="14" width="232" height="232" rx="12" fill={`url(#felt-${tableNumber})`} />
      <rect x="14" y="14" width="232" height="232" rx="12" fill={`url(#weave-${tableNumber})`} />
      <rect x="14" y="14" width="232" height="232" rx="12" fill={`url(#feltInner-${tableNumber})`} />
      {/* Coloured play mat resting on the felt */}
      <rect
        x="52" y="52" width="156" height="156" rx="14"
        fill={(TABLE_MATS[tableNumber] ?? TABLE_MATS[1]).base}
        stroke={(TABLE_MATS[tableNumber] ?? TABLE_MATS[1]).edge} strokeWidth="2"
      />
      <rect x="52" y="52" width="156" height="156" rx="14" fill={`url(#matSheen-${tableNumber})`} />

      {/* Inner stitch line */}
      <rect
        x="24" y="24" width="212" height="212" rx="8"
        fill="none" stroke="#A6916A" strokeWidth="0.7" strokeDasharray="3 3" opacity="0.55"
      />

      {/* Four winds at each edge */}
      <text x="130" y="46" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill="#13294A" opacity="0.65">北</text>
      <text x="226" y="138" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill="#13294A" opacity="0.65">東</text>
      <text x="130" y="232" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill="#13294A" opacity="0.65">南</text>
      <text x="34"  y="138" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill="#13294A" opacity="0.65">西</text>

      {/* Center: table name placard (Red, White, Pink, Blue) */}
      <g transform="translate(95 105)">
        <rect x="0" y="0" width="70" height="50" rx="6" fill="#FBF3DA" stroke="#A6916A" strokeWidth="0.8" />
        <rect x="3" y="3" width="64" height="44" rx="4" fill="none" stroke="#D9C696" strokeWidth="0.5" />
        <text x="35" y="28" textAnchor="middle" fontFamily="serif" fontSize="9" fontWeight="700" letterSpacing="2" fill="#13294A" opacity="0.55">TABLE</text>
        <text x="35" y="46" textAnchor="middle" fontFamily="serif" fontSize="14" fontWeight="700" fill={TABLE_NAME_COLORS[tableNumber] ?? "#B8302A"}>{TABLE_NAMES[tableNumber] ?? tableNumber}</text>
      </g>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Chair
   ───────────────────────────────────────────────────────────────────────── */

function Chair({
  profile,
  position,
  isMine,
  isPending,
  isRecentlyClaimed,
  onClaim,
}: {
  profile: Profile | null;
  position: SeatPosition;
  isMine: boolean;
  isPending: boolean;
  isRecentlyClaimed: boolean;
  onClaim: () => void;
}) {
  // Position the chair OUTSIDE the table edge.
  // Table is 260px wide on mobile, 290px on sm; chair sits ~52% from center along the axis.
  const positionStyles: Record<SeatPosition, React.CSSProperties> = {
    north: { left: "50%", top: "0%",  transform: "translate(-50%, -55%)" },
    south: { left: "50%", top: "100%", transform: "translate(-50%, -45%)" },
    east:  { left: "100%", top: "50%", transform: "translate(-45%, -50%)" },
    west:  { left: "0%",   top: "50%", transform: "translate(-55%, -50%)" },
  };

  const isEmpty = !profile;
  const label = profile
    ? `${profile.display_name} — ${POSITION_LABEL[position]} seat (table)`
    : `Empty ${POSITION_LABEL[position]} seat — click to sit`;

  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={isPending || (!isEmpty && !isMine && !!profile)}
      aria-label={label}
      title={profile ? profile.display_name : `Sit at the ${POSITION_LABEL[position]} seat`}
      className={[
        "group absolute h-8 w-8 sm:h-[72px] sm:w-[72px] rounded-full transition-all duration-300",
        "outline-none focus-visible:ring-2 focus-visible:ring-fox-yellow-500 focus-visible:ring-offset-2",
        isPending ? "opacity-50" : "",
        isMine ? "z-20 scale-[1.06]" : "z-10 hover:scale-[1.04]",
      ].join(" ")}
      style={positionStyles[position]}
    >
      {/* Outer ring */}
      <span
        className={[
          "absolute inset-0 rounded-full",
          isMine
            ? "ring-[3px] ring-fox-yellow-500 seat-mine-glow"
            : isEmpty
              ? "border-2 border-dashed border-fox-yellow-700/40 group-hover:border-fox-yellow-500/90"
              : "ring-2 ring-fox-cream-200",
        ].join(" ")}
      />
      {/* Inner content */}
      <span
        className={[
          "relative grid h-full w-full place-items-center overflow-hidden rounded-full",
          isRecentlyClaimed ? "seat-claim-anim" : "",
          isEmpty
            ? "bg-fox-cream-50/80 text-fox-yellow-700/55 group-hover:bg-fox-cream-100 group-hover:text-fox-yellow-700"
            : "bg-white shadow-sm",
        ].join(" ")}
      >
        {isEmpty ? (
          <PlusGlyph />
        ) : profile?.photo_url ? (
          <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-[10px] font-bold text-fox-navy-700 sm:text-base">
            {profile ? initialsOf(profile.display_name) : ""}
          </span>
        )}
      </span>
      {/* Wind glyph badge at the seat */}
      <span
        aria-hidden
        className="absolute -bottom-1 -right-1 grid h-2.5 w-2.5 place-items-center rounded-full bg-fox-cream-50 text-[7px] font-bold text-fox-navy-700 shadow-sm ring-1 ring-fox-cream-200 sm:h-5 sm:w-5 sm:text-[10px]"
      >
        {WIND_GLYPH[position]}
      </span>
      {profile?.is_helper && (
        <span
          aria-hidden
          title="Helper / instructor"
          className="absolute -top-1 -left-1 grid h-2.5 w-2.5 place-items-center rounded-full bg-fox-yellow-500 text-[7px] font-bold text-fox-navy-900 shadow-sm sm:h-5 sm:w-5 sm:text-[10px]"
        >
          ★
        </span>
      )}
    </button>
  );
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[11px] w-[11px] sm:h-[22px] sm:w-[22px]" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Bottom status bar
   ───────────────────────────────────────────────────────────────────────── */

function YourSeatBar({
  mySeat,
  user,
  onRelease,
  releasing,
}: {
  mySeat: Seat | null;
  user: { id: string } | null;
  onRelease: (seatId: string) => void;
  releasing: boolean;
}) {
  if (!user) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-fox-cream-200 bg-fox-cream-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm text-fox-ink/75">Sign in to reserve a seat.</p>
          <Link to="/login" className="btn-primary text-sm">Sign in</Link>
        </div>
      </div>
    );
  }

  if (!mySeat) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-fox-cream-200 bg-fox-cream-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm text-fox-ink/75">
            <span className="font-medium text-fox-navy-700">Pick any empty chair</span> to claim it.
          </p>
          <span className="text-xs text-fox-ink/55">Click another chair anytime to switch.</span>
        </div>
      </div>
    );
  }

  function handleRelease() {
    if (!mySeat || releasing) return;
    const ok = window.confirm("Release your seat? Someone else can grab it once you do.");
    if (ok) onRelease(mySeat.id);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-fox-yellow-500/40 bg-fox-yellow-500/10 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="text-sm">
          <span className="font-display text-lg text-fox-navy-700">You're in.</span>{" "}
          <span className="text-fox-ink/75">
            <span className="font-semibold text-fox-navy-700">{TABLE_NAMES[mySeat.table_number] ?? mySeat.table_number}</span> table,{" "}
            <span className="font-semibold text-fox-navy-700">{POSITION_LABEL[mySeat.seat_position]}</span> seat ({WIND_GLYPH[mySeat.seat_position]}).
          </span>
        </p>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-fox-ink/55 sm:inline">Click another chair to switch.</span>
          <button
            type="button"
            onClick={handleRelease}
            disabled={releasing}
            className="rounded-full border border-tile-red/40 bg-white px-3.5 py-1.5 text-sm font-medium text-tile-red transition hover:bg-tile-red/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {releasing ? "Releasing…" : "Leave seat"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionGlyph({ glyph, color }: { glyph: string; color: string }) {
  return (
    <svg width="72" height="100" viewBox="0 0 40 56" className="drop-shadow-sm" aria-hidden>
      <rect x="1" y="1" width="38" height="54" rx="6" ry="6" fill="#FBF3DA" stroke="#A6916A" strokeWidth="1" />
      <rect x="3" y="3" width="34" height="50" rx="4.5" ry="4.5" fill="none" stroke="#D9C696" strokeWidth="0.6" />
      <text x="20" y="37" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill={color}>
        {glyph}
      </text>
    </svg>
  );
}

function CenteredSpinner() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-fox-yellow-500/30 border-t-fox-yellow-500" />
        <p className="text-sm text-fox-ink/60">Setting the table…</p>
      </div>
    </main>
  );
}
