import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { fetchMyReservations } from "../lib/dataApi";
import { formatSessionDate } from "../lib/utils";
import type { Seat, SessionRow } from "../lib/database.types";
import { SESSION_TEMPLATES } from "../data/sessionTemplates";

const POSITION_LABEL: Record<string, string> = {
  east: "East",
  south: "South",
  west: "West",
  north: "North",
};
const TABLE_NAMES: Record<number, string> = { 1: "Red", 2: "White", 3: "Pink", 4: "Blue" };
const WIND_GLYPH: Record<string, string> = {
  east: "東",
  south: "南",
  west: "西",
  north: "北",
};

export default function MePage() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<Array<{ session: SessionRow; seat: Seat }> | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetchMyReservations(user.id);
        if (alive) setRows(r);
      } catch (err) {
        if (alive) setErrMsg(err instanceof Error ? err.message : "Failed to load reservations.");
      }
    })();
    return () => { alive = false; };
  }, [user]);

  const upcoming = (rows ?? []).filter(
    (r) => new Date(r.session.starts_at) > new Date(),
  );
  const past = (rows ?? []).filter(
    (r) => new Date(r.session.starts_at) <= new Date(),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      <div className="mb-7">
        <p className="pill">My seats</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">
          {profile?.display_name ? `${profile.display_name}'s summer.` : "Your seats."}
        </h1>
        <p className="mt-2 text-fox-ink/75">
          Where you'll be sitting. Need to cancel?{" "}
          <a href="mailto:mlittle@foxhill-school.com" className="font-medium text-fox-navy-700 underline-offset-2 hover:underline">
            Email Mrs. Little
          </a>.
        </p>
      </div>

      {errMsg && (
        <p className="card mb-6 border-tile-red/40 bg-tile-red/5 p-4 text-sm text-tile-red">{errMsg}</p>
      )}

      {rows === null ? (
        <p className="text-sm text-fox-ink/55">Loading…</p>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-fox-yellow-700">
                Coming up
              </h2>
              <ul className="space-y-3">
                {upcoming.map((r) => <ReservationRow key={r.seat.id} session={r.session} seat={r.seat} />)}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <section className="opacity-70">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-fox-ink/45">
                Already played
              </h2>
              <ul className="space-y-3">
                {past.slice(0, 6).map((r) => <ReservationRow key={r.seat.id} session={r.session} seat={r.seat} />)}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ReservationRow({ session, seat }: { session: SessionRow; seat: Seat }) {
  const tpl = SESSION_TEMPLATES.find((t) => t.type === session.type);
  const d = formatSessionDate(session.starts_at);
  return (
    <li>
      <Link
        to={`/session/${session.id}`}
        className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <SmallTile glyph={tpl?.glyph ?? "・"} color={tpl?.glyphColor ?? "#13294A"} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-fox-navy-700">{tpl?.title ?? session.type}</p>
          <p className="text-sm text-fox-ink/70">
            {d.day}, {d.date} · {d.time}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-xs uppercase tracking-widest text-fox-ink/50">Seat</p>
          <p className="font-display text-lg text-fox-navy-700">
            <span className="font-semibold">{TABLE_NAMES[seat.table_number] ?? seat.table_number}</span> table · {WIND_GLYPH[seat.seat_position]}
            <span className="ml-1 text-sm font-normal text-fox-ink/60">
              ({POSITION_LABEL[seat.seat_position]})
            </span>
          </p>
        </div>
        <span aria-hidden className="text-fox-ink/30">›</span>
      </Link>
    </li>
  );
}

function SmallTile({ glyph, color }: { glyph: string; color: string }) {
  return (
    <svg width="38" height="54" viewBox="0 0 40 56" className="shrink-0 drop-shadow-sm" aria-hidden>
      <rect x="1" y="1" width="38" height="54" rx="6" ry="6" fill="#FBF3DA" stroke="#A6916A" strokeWidth="0.9" />
      <text x="20" y="37" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill={color}>
        {glyph}
      </text>
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <p className="font-display text-2xl text-fox-navy-700">No seats yet.</p>
      <p className="mt-2 text-fox-ink/70">Pick a session and grab a chair.</p>
      <Link to="/" className="btn-primary mt-5">Browse sessions</Link>
    </div>
  );
}
