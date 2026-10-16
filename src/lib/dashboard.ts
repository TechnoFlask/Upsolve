import "server-only";
import { and, asc, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { contests, problems } from "@/db/schema";
import { toDateInput } from "@/lib/dates";
import {
  addDays,
  ratingBuckets,
  countByDay,
  heatmapWeeks,
  isSolved,
  streaks,
  tagStats,
} from "@/lib/stats";

export async function loadDashboard() {
  const [rows, ratingRows] = await Promise.all([
    db
      .select({
        platform: problems.platform,
        difficulty: problems.difficulty,
        tags: problems.tags,
        status: problems.status,
        solvedAt: problems.solvedAt,
        usedEditorial: problems.usedEditorial,
      })
      .from(problems),
    db
      .select({
        platform: contests.platform,
        date: contests.date,
        name: contests.name,
        oldRating: contests.oldRating,
        newRating: contests.newRating,
      })
      .from(contests)
      .where(and(isNotNull(contests.newRating), isNotNull(contests.date)))
      .orderBy(asc(contests.date)),
  ]);

  const today = toDateInput(new Date());
  const solved = rows.filter(isSolved);
  const solveDays = solved.flatMap((p) => (p.solvedAt ? [toDateInput(p.solvedAt)] : []));
  const counts = countByDay(solveDays);
  const weekStart = addDays(today, -6);

  // Codeforces always gets a section (with empty states); AtCoder once there's something to show.
  const judges = (["codeforces", "atcoder"] as const)
    .map((platform) => {
      const rating = ratingRows
        .filter((r) => r.platform === platform)
        .map((r) => ({ date: r.date!, rating: r.newRating!, contest: r.name, delta: r.newRating! - (r.oldRating ?? 0) }));
      return {
        platform,
        rating,
        maxRating: rating.length ? Math.max(...rating.map((r) => r.rating)) : null,
        buckets: ratingBuckets(rows, platform),
      };
    })
    .filter((j) => j.platform === "codeforces" || j.rating.length > 0 || j.buckets.length > 0);

  return {
    totalSolved: solved.length,
    solvedThisWeek: solveDays.filter((d) => d >= weekStart).length,
    streak: streaks(new Set(solveDays), today),
    heatmap: heatmapWeeks(counts, today),
    judges,
    tags: tagStats(rows).slice(0, 15),
  };
}
