import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SESSION_TEMPLATES } from "../data/sessionTemplates";
import { fetchSessionsInRange } from "../lib/dataApi";
import { supabase } from "../lib/supabase";
import type { SessionRow } from "../lib/database.types";
import { formatSessionDate } from "../lib/utils";
import { visibleCapacityFromSeats } from "../lib/seatLogic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDay(iso: string): string {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const START_YEAR = 2026;
const START_MONTH = 5; // June (0-indexed)

interface Props {
  authLoading: boolean;
}

export default function Calendar({ authLoading }: Props) {
  const today = new Date();
  const [year, setYear] = useState(START_YEAR);
  const [month, setMonth] = useState(START_MONTH);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [daySeatCounts, setDaySeatCounts] = useState<Record<string, number>>({});
  const [daySeatMax, setDaySeatMax] = useState<Record<string, number>>({});

  const atMin = year === START_YEAR && month === START_MONTH;

  // Group sessions by local date key, sorted by start time within each day.
  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionRow[]> = {};
    for (const s of sessions) {
      const key = toLocalDay(s.starts_at);
      (map[key] ??= []).push(s);
    }
    for (const key in map) {
      map[key].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return map;
  }, [sessions]);

  // Build the calendar day grid (nulls = empty cells before/after month).
  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  useEffect(() => {
    if (authLoading) return;
    setFetching(true);
    setSelectedDay(null);
    // Pad the query range by 1 day each side to absorb timezone offset (EDT = UTC-4).
    const from = new Date(year, month, 0).toISOString();
    const to = new Date(year, month + 1, 2).toISOString();
    fetchSessionsInRange(from, to)
      .then((rows) => setSessions(rows.filter((s) => s.starts_at >= "2026-06-30")))
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [year, month, authLoading]);

  // Fetch seat counts whenever a day is selected.
  useEffect(() => {
    if (!selectedDay) {
      setDaySeatCounts({});
      setDaySeatMax({});
      return;
    }
    const daySessions = sessions.filter((s) => toLocalDay(s.starts_at) === selectedDay);
    if (daySessions.length === 0) return;
    const ids = daySessions.map((s) => s.id);
    type SeatLite = { session_id: string; profile_id: string | null; table_number: number };
    void (async () => {
      try {
        const { data } = await supabase
          .from("seats")
          .select("session_id, profile_id, table_number")
          .in("session_id", ids);
        const rows = (data ?? []) as unknown as SeatLite[];
        const counts: Record<string, number> = {};
        const maxes: Record<string, number> = {};
        for (const s of daySessions) {
          const tpl = SESSION_TEMPLATES.find((t) => t.type === s.type);
          const own = rows.filter((r) => r.session_id === s.id);
          counts[s.id] = own.filter((r) => r.profile_id).length;
          maxes[s.id] = tpl
            ? visibleCapacityFromSeats(own, tpl.maxTables, tpl.fixedTables)
            : 0;
        }
        setDaySeatCounts(counts);
        setDaySeatMax(maxes);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedDay, sessions]);

  const todayKey = toLocalDay(today.toISOString());

  function prevMonth() {
    if (atMin) return;
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const selectedSessions = selectedDay ? (sessionsByDay[selectedDay] ?? []) : [];

  return (
    <section className="card overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center gap-3 border-b border-fox-cream-200 px-5 py-4">
        <button
          type="button"
          onClick={prevMonth}
          disabled={atMin}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-full text-lg text-fox-navy-700 transition hover:bg-fox-cream-100 disabled:cursor-not-allowed disabled:opacity-25"
        >
          ‹
        </button>
        <p className="flex-1 text-center font-display text-lg text-fox-navy-700">
          {MONTH_NAMES[month]} {year}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-full text-lg text-fox-navy-700 transition hover:bg-fox-cream-100"
        >
          ›
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-fox-cream-200 bg-fox-cream-50/60">
        {DAY_ABBR.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-fox-ink/45"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — session days are 3× taller than empty days */}
      <div className={`grid grid-cols-7 transition-opacity ${fetching ? "opacity-40" : ""}`}>
        {cells.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`e-${i}`}
                className="border-b border-r border-fox-cream-100/70 bg-fox-cream-50/30 last-of-type:border-r-0"
              />
            );
          }
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const daySess = sessionsByDay[key] ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          const hasSess = daySess.length > 0;
          const isLastInRow = (i + 1) % 7 === 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => hasSess && setSelectedDay(isSelected ? null : key)}
              disabled={!hasSess}
              className={[
                "group border-b border-fox-cream-100/70 p-1.5 text-left transition",
                hasSess ? "min-h-[162px]" : "min-h-[54px]",
                isLastInRow ? "" : "border-r",
                isSelected
                  ? "bg-fox-yellow-500/10"
                  : hasSess
                    ? "cursor-pointer hover:bg-fox-cream-100/80"
                    : "cursor-default",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday
                    ? "bg-fox-navy-700 font-bold text-fox-cream-50"
                    : isSelected
                      ? "bg-fox-yellow-500/20 font-semibold text-fox-navy-700"
                      : "text-fox-ink/70",
                ].join(" ")}
              >
                {day}
              </span>
              {hasSess && (
                <div className="mt-2 space-y-1.5">
                  {daySess.map((s) => {
                    const tpl = SESSION_TEMPLATES.find((t) => t.type === s.type);
                    return (
                      <div key={s.id} className="flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: tpl?.glyphColor ?? "#13294A" }}
                        />
                        <p className="truncate text-[9px] font-medium leading-tight text-fox-navy-700">
                          {tpl?.title}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded day panel — full session cards matching the homepage style */}
      {selectedDay && selectedSessions.length > 0 && (
        <div className="border-t border-fox-cream-200 p-4 sm:p-6">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-fox-ink/55">
            {new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <div className={`grid gap-4 ${selectedSessions.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {selectedSessions.map((s) => (
              <CalendarSessionCard
                key={s.id}
                session={s}
                seatsTaken={daySeatCounts[s.id] ?? 0}
                seatsMax={daySeatMax[s.id] ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legend — deduplicated by title so "Lesson for Beginners" appears once */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-fox-cream-200 px-5 py-3">
        {SESSION_TEMPLATES
          .filter((tpl, i, arr) => arr.findIndex((t) => t.title === tpl.title) === i)
          .map((tpl) => (
            <div key={tpl.type} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: tpl.glyphColor }}
              />
              <span className="text-xs text-fox-ink/60">{tpl.title}</span>
            </div>
          ))}
      </div>
    </section>
  );
}

// Full session card — mirrors the SessionCard layout on the homepage.
function CalendarSessionCard({
  session,
  seatsTaken,
  seatsMax,
}: {
  session: SessionRow;
  seatsTaken: number;
  seatsMax: number;
}) {
  const tpl = SESSION_TEMPLATES.find((t) => t.type === session.type);
  if (!tpl) return null;

  // Capacity comes from the real seat rows (see seatLogic); fall back to one
  // table until the counts load.
  const visibleMax = seatsMax || 4;
  const isFull = seatsTaken >= visibleMax;

  const d = formatSessionDate(session.starts_at);
  const end = formatSessionDate(session.ends_at);

  return (
    <article className="group card relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fox-yellow-500/60 via-fox-yellow-300/50 to-fox-yellow-500/60 opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start gap-3 border-b border-fox-cream-200 p-5">
        <CalendarTile glyph={tpl.glyph} color={tpl.glyphColor} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.84rem]">{tpl.title}</h3>
          <p className="text-sm text-fox-ink/70">{tpl.tagline}</p>
        </div>
      </div>
      <div className="flex-1 p-5">
        <p className="mb-2 text-sm font-medium text-fox-navy-700">
          {d.day}, {d.date} · {d.time} – {end.time}
        </p>
        <p className="text-sm text-fox-ink/75">{tpl.description}</p>
        {session.notes && (
          <p className="mt-3 border-t border-fox-cream-100 pt-3 text-sm text-fox-ink/65">
            {session.notes}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-fox-cream-200 bg-fox-cream-50/60 px-5 py-3">
        <span className="text-sm text-fox-ink/70">
          <span className="font-semibold text-fox-navy-700">{seatsTaken}</span>
          <span className="text-fox-ink/50"> / {visibleMax} seats</span>
        </span>
        {isFull ? (
          <span className="rounded-full bg-tile-red/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-tile-red">
            Full
          </span>
        ) : (
          <Link to={`/session/${session.id}`} className="btn-primary">
            Pick a seat
          </Link>
        )}
      </div>
    </article>
  );
}

function CalendarTile({ glyph, color }: { glyph: string; color: string }) {
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
