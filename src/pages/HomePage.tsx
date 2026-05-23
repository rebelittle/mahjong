import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SESSION_TEMPLATES, type SessionTemplate } from "../data/sessionTemplates";
import { ensureSessionsMaterialized, fetchUpcomingByType } from "../lib/dataApi";
import type { SessionRow, SessionType } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { formatSessionDate } from "../lib/utils";

export default function HomePage() {
  const { user, profile } = useAuth();
  const [upcoming, setUpcoming] = useState<Record<SessionType, SessionRow | null> | null>(null);
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureSessionsMaterialized(14);
      const data = await fetchUpcomingByType();
      if (!alive) return;
      setUpcoming(data);
      const ids = Object.values(data).filter(Boolean).map((s) => s!.id);
      if (ids.length > 0) {
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
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
      <section className="card mb-10 overflow-hidden">
        <div className="grid gap-6 p-7 sm:grid-cols-[1.4fr_1fr] sm:p-9">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-fox-yellow-700">
              Summer 2026 · Fox Hill School
            </p>
            <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
              A summer of <em className="font-display italic text-fox-yellow-600">mahjong</em>,
              <br className="hidden sm:block" /> right at school.
            </h1>
            <p className="mt-5 max-w-xl text-fox-ink/75">
              Three friendly weekly sessions all summer long. Pick the one you want, grab
              your seat, and see who's joining you at the table. An advanced player
              floats around every game to help when you need it.
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

      <div id="sessions" className="mb-4 flex items-baseline justify-between">
        <h2 className="text-2xl">This week's sessions</h2>
        <span className="text-xs uppercase tracking-widest text-fox-ink/50">4 tables · 16 seats</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SESSION_TEMPLATES.map((tpl) => {
          const session = upcoming?.[tpl.type] ?? null;
          return (
            <SessionCard
              key={tpl.type}
              template={tpl}
              session={session}
              seatsTaken={session ? (seatCounts[session.id] ?? 0) : 0}
            />
          );
        })}
      </div>

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
  session: SessionRow | null;
  seatsTaken: number;
}) {
  const dateLabel = session
    ? (() => {
        const d = formatSessionDate(session.starts_at);
        return `${d.day}, ${d.date} · ${d.time}`;
      })()
    : `${template.dayLabel} · ${template.timeLabel}`;

  return (
    <article className="group card relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fox-yellow-500/60 via-fox-yellow-300/50 to-fox-yellow-500/60 opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start gap-3 border-b border-fox-cream-200 p-5">
        <CardTile glyph={template.glyph} color={template.glyphColor} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg">{template.title}</h3>
          <p className="text-sm text-fox-ink/70">{template.tagline}</p>
        </div>
      </div>
      <div className="flex-1 p-5">
        <p className="mb-2 text-sm font-medium text-fox-navy-700">{dateLabel}</p>
        <p className="text-sm text-fox-ink/75">{template.description}</p>
      </div>
      {session && (
        <div className="flex items-center justify-between border-t border-fox-cream-200 bg-fox-cream-50/60 px-5 py-3">
          <span className="text-sm text-fox-ink/70">
            <span className="font-semibold text-fox-navy-700">{seatsTaken}</span>
            <span className="text-fox-ink/50"> / 16 seats</span>
          </span>
          <Link to={`/session/${session.id}`} className="btn-primary">Pick a seat</Link>
        </div>
      )}
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
