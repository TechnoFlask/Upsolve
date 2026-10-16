// Pure dashboard calculations. Days are "YYYY-MM-DD" strings in the display timezone.
import type { Platform, Status } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function countByDay(days: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
  return counts;
}

/**
 * Current streak: consecutive solve days ending today, or ending yesterday if
 * you haven't solved anything yet today (the streak is still alive).
 */
export function streaks(solveDays: Set<string>, today: string): { current: number; longest: number } {
  let current = 0;
  let cursor = solveDays.has(today) ? today : addDays(today, -1);
  while (solveDays.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  for (const day of solveDays) {
    if (solveDays.has(addDays(day, -1))) continue; // not the start of a run
    let len = 0;
    let d = day;
    while (solveDays.has(d)) {
      len++;
      d = addDays(d, 1);
    }
    longest = Math.max(longest, len);
  }
  return { current, longest };
}

export type HeatmapCell = { day: string; count: number; future: boolean };

/** Weeks (Monday-first columns) covering the last `weeks` weeks up to today. */
export function heatmapWeeks(counts: Map<string, number>, today: string, weeks = 53): HeatmapCell[][] {
  const start = addDays(today, -weekdayMon0(today) - (weeks - 1) * 7);
  const result: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      column.push({ day, count: counts.get(day) ?? 0, future: day > today });
    }
    result.push(column);
  }
  return result;
}

export type StatProblem = {
  platform: Platform;
  difficulty: number | null;
  tags: string[];
  status: Status;
  solvedAt: Date | null;
  usedEditorial: boolean;
};

export const isSolved = (p: Pick<StatProblem, "status" | "solvedAt">) => p.status === "solved" || p.solvedAt != null;

/**
 * Solved problems on one judge per 100-point difficulty bucket, lowest first.
 * Codeforces ratings start at 800; AtCoder estimates can sit anywhere above 0.
 */
export function ratingBuckets(problems: StatProblem[], platform: "codeforces" | "atcoder"): { rating: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const p of problems) {
    if (p.platform !== platform || p.difficulty == null || !isSolved(p)) continue;
    const bucket = Math.floor(p.difficulty / 100) * 100;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const ratings = [...counts.keys()];
  const lo = platform === "codeforces" ? Math.min(800, ...ratings) : Math.min(...ratings);
  const hi = Math.max(...ratings);
  const out = [];
  for (let r = lo; r <= hi; r += 100) out.push({ rating: r, count: counts.get(r) ?? 0 });
  return out;
}

export type TagStat = {
  tag: string;
  solved: number;
  unsolved: number;
  editorial: number;
  /** Struggling here: low solve rate or leaning on editorials, with enough attempts to tell. */
  weak: boolean;
};

export function tagStats(problems: StatProblem[]): TagStat[] {
  const byTag = new Map<string, TagStat>();
  for (const p of problems) {
    const solved = isSolved(p);
    for (const tag of p.tags) {
      const s = byTag.get(tag) ?? { tag, solved: 0, unsolved: 0, editorial: 0, weak: false };
      if (solved) s.solved++;
      else s.unsolved++;
      if (p.usedEditorial) s.editorial++;
      byTag.set(tag, s);
    }
  }
  for (const s of byTag.values()) {
    const total = s.solved + s.unsolved;
    s.weak = total >= 2 && (s.solved / total < 0.6 || s.editorial / total >= 0.5);
  }
  return [...byTag.values()].sort((a, b) => b.solved + b.unsolved - (a.solved + a.unsolved) || a.tag.localeCompare(b.tag));
}
