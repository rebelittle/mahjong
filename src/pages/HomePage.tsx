import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SESSION_AMENITIES, SESSION_TEMPLATES, type SessionTemplate } from "../data/sessionTemplates";
import { ensureSessionsMaterialized, fetchNextSessions } from "../lib/dataApi";
import type { SessionRow } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { formatSessionDate } from "../lib/utils";
import Calendar from "../components/Calendar";

// The programme start date: sessions are created from this Sunday onward so
// no sessions materialise in the week before Jun 30.
const PROGRAMME_START = "2026-06-28";

export default function HomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [nextSessions, setNextSessions] = useState<SessionRow[]>([]);
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    (async () => {
      await ensureSessionsMaterialized(5, PROGRAMME_START);
      const sessions = await fetchNextSessions(3);
      if (!alive) return;
      setNextSessions(sessions);
      if (sessions.length > 0) {
        const ids = sessions.map((s) => s.id);
        const { data: seats } = await supabase
          .from("seats")
          .select("session_id, profile_id")
          .in("session_id", ids);
        type SeatLite = { session_id: string; profile_id: string | null };
        const counts: Record<string, number> = {};
        for (const id of ids) counts[id] = 0;
        for (const s of (seats ?? []) as unknown as SeatLite[]) {
          if (s.profile_id) counts[s.session_id] = (counts[s.session_id] ?? 0) + 1;
        }
        if (alive) setSeatCounts(counts);
      }
    })();
    return () => { alive = false; };
  }, [authLoading]);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
      {/* ── Hero ── */}
      <section className="card mb-10 overflow-hidden">
        <div className="grid gap-6 p-7 sm:grid-cols-[1.4fr_1fr] sm:p-9">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-fox-yellow-700">
              Summer 2026 · Fox Hill School
            </p>
            <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
              A summer of <em className="font-display italic text-fox-yellow-600">Mah Jongg</em>
              <br className="hidden sm:block" />
            </h1>
            <p className="mt-5 max-w-xl text-fox-ink/75">
              Wonder what all the hype around Mah Jongg is about? It's more than just a
              game — it's a chance to challenge your mind, connect with friends, and
              discover your community! Join us at the table!
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {user ? (
                profile ? (
                  <Link to="/me" className="btn-primary">View my seats</Link>
                ) : (
                  <Link to="/profile" className="btn-primary">Finish your profile</Link>
                )
              ) : (
                <Link to="/login" className="btn-primary">Sign in to reserve</Link>
              )}
            </div>
          </div>
          <DecorativeTileStack />
        </div>
      </section>

      {/* ── Next 3 session cards ── */}
      <div id="sessions" className="mb-4 flex items-baseline justify-between">
        <h2 className="text-2xl">Upcoming sessions</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nextSessions.length > 0
          ? nextSessions.map((session) => {
              const tpl = SESSION_TEMPLATES.find((t) => t.type === session.type);
              if (!tpl) return null;
              return (
                <SessionCard
                  key={session.id}
                  template={tpl}
                  session={session}
                  seatsTaken={seatCounts[session.id] ?? 0}
                />
              );
            })
          : SESSION_TEMPLATES.slice(0, 3).map((tpl) => (
              <SessionCardSkeleton key={tpl.type} template={tpl} />
            ))}
      </div>

      {/* ── Monthly calendar ── */}
      <div className="mb-4 mt-12 flex items-baseline justify-between">
        <h2 className="text-2xl">Full schedule</h2>
        <span className="text-xs uppercase tracking-widest text-fox-ink/50">Click a day to see sessions</span>
      </div>
      <Calendar authLoading={authLoading} />

      {/* ── Good to know ── */}
      <section className="card mt-12 overflow-hidden">
        <div className="p-7 sm:p-8">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-fox-yellow-700">
            Good to know
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SESSION_AMENITIES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-fox-ink/80">
                <span aria-hidden className="mt-0.5 text-fox-yellow-600">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-12 text-center text-sm text-fox-ink/55">
        Questions? Talk to Mrs. Little at drop-off, or email
        {" "}<span className="font-medium text-fox-navy-700">mlittle@foxhill-school.com</span>.
      </p>
    </main>
  );
}

function SessionCard({
  template,
  session,
  seatsTaken,
}: {
  template: SessionTemplate;
  session: SessionRow;
  seatsTaken: number;
}) {
  const d = formatSessionDate(session.starts_at);
  const dateLabel = `${d.day}, ${d.date} · ${d.time}`;

  // Visible seat cap based on how many tables are unlocked for this type.
  const max = template.maxTables;
  const visibleMax =
    max <= 2
      ? seatsTaken >= 4 ? 8 : 4
      : seatsTaken >= 12 ? 16 : seatsTaken >= 8 ? 12 : 8;

  return (
    <article className="group card relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fox-yellow-500/60 via-fox-yellow-300/50 to-fox-yellow-500/60 opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start gap-3 border-b border-fox-cream-200 p-5">
        <CardTile glyph={template.glyph} color={template.glyphColor} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.84rem]">{template.title}</h3>
          <p className="text-sm text-fox-ink/70">{template.tagline}</p>
        </div>
      </div>
      <div className="flex-1 p-5">
        <p className="mb-2 text-sm font-medium text-fox-navy-700">{dateLabel}</p>
        <p className="text-sm text-fox-ink/75">{template.description}</p>
      </div>
      <div className="flex items-center justify-between border-t border-fox-cream-200 bg-fox-cream-50/60 px-5 py-3">
        <span className="text-sm text-fox-ink/70">
          <span className="font-semibold text-fox-navy-700">{seatsTaken}</span>
          <span className="text-fox-ink/50"> / {visibleMax} seats</span>
        </span>
        <Link to={`/session/${session.id}`} className="btn-primary">Pick a seat</Link>
      </div>
    </article>
  );
}

// Shown while sessions are loading — same shape but no date/button.
function SessionCardSkeleton({ template }: { template: SessionTemplate }) {
  return (
    <article className="card relative flex flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-fox-cream-200 p-5">
        <CardTile glyph={template.glyph} color={template.glyphColor} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.84rem]">{template.title}</h3>
          <p className="text-sm text-fox-ink/70">{template.tagline}</p>
        </div>
      </div>
      <div className="flex-1 p-5">
        <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-fox-cream-200" />
        <p className="text-sm text-fox-ink/75">{template.description}</p>
      </div>
      <div className="flex items-center justify-between border-t border-fox-cream-200 bg-fox-cream-50/60 px-5 py-3">
        <div className="h-4 w-16 animate-pulse rounded bg-fox-cream-200" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-fox-cream-200" />
      </div>
    </article>
  );
}

function CardTile({ glyph, color }: { glyph: string; color: string }) {
  return (
    <svg width="44" height="60" viewBox="0 0 40 56" className="shrink-0 drop-shadow-sm" aria-hidden>
      <rect x="1" y="1" width="38" height="54" rx="6" ry="6" fill="#FBF3DA" stroke="#A6916A" strokeWidth="1" />
      <rect x="3" y="3" width="34" height="50" rx="4.5" ry="4.5" fill="none" stroke="#D9C696" strokeWidth="0.6" />
      <text x="20" y="36" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill={color}>
        {glyph}
      </text>
    </svg>
  );
}

function DecorativeTileStack() {
  return (
    <div className="relative hidden h-44 sm:block">
      <FloatingTile glyph="東" color="#0F8A5F" tilt={-9} x="6%"  y="8%"  delay="0s" />
      <FloatingTile glyph="南" color="#B8302A" tilt={6}  x="30%" y="30%" delay="0.3s" />
      <FloatingTile glyph="西" color="#1F5BA8" tilt={-4} x="55%" y="6%"  delay="0.6s" />
      <FloatingTile glyph="北" color="#13294A" tilt={10} x="70%" y="42%" delay="0.9s" />
    </div>
  );
}

function FloatingTile({
  glyph, color, tilt, x, y, delay,
}: { glyph: string; color: string; tilt: number; x: string; y: string; delay: string }) {
  return (
    <svg
      width="68"
      height="94"
      viewBox="0 0 40 56"
      className="absolute drop-shadow-md"
      style={{
        left: x,
        top: y,
        transform: `rotate(${tilt}deg)`,
        animation: `tileFloat 6s ease-in-out ${delay} infinite`,
      }}
      aria-hidden
    >
      <rect x="1" y="1" width="38" height="54" rx="6" ry="6" fill="#FBF3DA" stroke="#A6916A" strokeWidth="0.9" />
      <rect x="3" y="3" width="34" height="50" rx="4.5" ry="4.5" fill="none" stroke="#D9C696" strokeWidth="0.6" />
      <text x="20" y="37" textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="700" fill={color}>
        {glyph}
      </text>
    </svg>
  );
}
