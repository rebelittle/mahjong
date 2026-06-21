import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SESSION_TEMPLATES } from "../data/sessionTemplates";
import { fetchSessionsInRange } from "../lib/dataApi";
import type { SessionRow } from "../lib/database.types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Convert an ISO timestamp to YYYY-MM-DD in the user's local timezone.
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

  const atMin = year === START_YEAR && month === START_MONTH;

  useEffect(() => {
    if (authLoading) return;
    setFetching(true);
    setSelectedDay(null);
    // Pad the query range by 1 day each side to absorb timezone offset (EDT = UTC-4).
    const from = new Date(year, month, 0).toISOString();
    const to = new Date(year, month + 1, 2).toISOString();
    // Belt-and-suspenders: drop any orphaned pre-programme sessions regardless of
    // whether migration 0008 has been run (first real session is Jun 30 2026).
    fetchSessionsInRange(from, to)
      .then((rows) => setSessions(rows.filter((s) => s.starts_at >= "2026-06-30")))
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [year, month, authLoading]);

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

      {/* Calendar grid */}
      <div className={`grid grid-cols-7 transition-opacity ${fetching ? "opacity-40" : ""}`}>
        {cells.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`e-${i}`}
                className="min-h-[54px] border-b border-r border-fox-cream-100/70 bg-fox-cream-50/30 last-of-type:border-r-0"
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
                "group min-h-[54px] border-b border-fox-cream-100/70 p-1.5 text-left transition",
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
              {daySess.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-[3px]">
                  {daySess.map((s) => {
                    const tpl = SESSION_TEMPLATES.find((t) => t.type === s.type);
                    return (
                      <span
                        key={s.id}
                        className="h-[6px] w-[6px] rounded-full"
                        style={{ background: tpl?.glyphColor ?? "#13294A" }}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded day panel */}
      {selectedDay && selectedSessions.length > 0 && (
        <div className="border-t border-fox-cream-200 bg-fox-cream-50/70 p-4 sm:p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-fox-ink/55">
            {new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedSessions.map((s) => {
              const tpl = SESSION_TEMPLATES.find((t) => t.type === s.type);
              if (!tpl) return null;
              const startD = new Date(s.starts_at);
              const endD = new Date(s.ends_at);
              const timeStr = `${startD.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${endD.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
              return (
                <Link
                  key={s.id}
                  to={`/session/${s.id}`}
                  className="flex items-center gap-3 rounded-xl border border-fox-cream-200 bg-white px-3.5 py-3 transition hover:border-fox-yellow-500/50 hover:shadow-sm"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: tpl.glyphColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fox-navy-700">{tpl.title}</p>
                    <p className="text-xs text-fox-ink/60">{timeStr}</p>
                  </div>
                  <span className="btn-primary shrink-0 text-xs">Pick a seat</span>
                </Link>
              );
            })}
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
