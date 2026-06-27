import type { Seat } from "./database.types";

// Only the fields needed to reason about table visibility/capacity.
type SeatLite = Pick<Seat, "table_number" | "profile_id">;

// Returns the set of table numbers (1..4) that are visible AND actually exist
// (have at least one seat row in the DB). This mirrors the progressive-unlock
// logic on the session page, but also respects tables whose seats were deleted
// to cap a session — so a session capped at 2 tables reports 8 seats, not 12.
export function visibleTablesFromSeats(
  seats: SeatLite[],
  maxTables: number,
  fixedTables?: number,
): Set<number> {
  const tables: Record<number, SeatLite[]> = {};
  for (const s of seats) {
    if (s.table_number >= 1 && s.table_number <= 4) {
      (tables[s.table_number] ??= []).push(s);
    }
  }
  const isTableFull = (n: number) =>
    (tables[n]?.length ?? 0) > 0 && tables[n].every((s) => s.profile_id);
  const tableHasAnyone = (n: number) => (tables[n] ?? []).some((s) => s.profile_id);
  const tableExists = (n: number) => (tables[n]?.length ?? 0) > 0;
  const startCount = maxTables <= 2 ? 1 : 2;

  const visible = new Set<number>();
  if (fixedTables !== undefined) {
    for (let n = 1; n <= fixedTables; n++) visible.add(n);
  } else {
    for (let n = 1; n <= startCount; n++) visible.add(n);
    // Sequentially unlock each next table once all previous ones are full.
    for (let n = startCount + 1; n <= maxTables; n++) {
      if (!visible.has(n - 1)) break;
      const allPrevFull = Array.from({ length: n - 1 }, (_, i) => i + 1).every(isTableFull);
      if (!allPrevFull) break;
      visible.add(n);
    }
  }
  // Safety: never hide a table that already has a seated player.
  for (let n = 1; n <= 4; n++) if (tableHasAnyone(n)) visible.add(n);
  // Drop any table that doesn't actually exist (its seats were deleted).
  return new Set([...visible].filter(tableExists));
}

export function visibleCapacityFromSeats(
  seats: SeatLite[],
  maxTables: number,
  fixedTables?: number,
): number {
  return visibleTablesFromSeats(seats, maxTables, fixedTables).size * 4;
}
