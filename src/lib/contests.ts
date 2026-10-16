import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { contestProblems, contests, problems, type Contest, type Problem } from "@/db/schema";
import type { Platform, SolvedDuring, Status } from "@/lib/constants";

/**
 * Your result on one problem of a contest:
 * - during: accepted while taking part (live or virtual)
 * - upsolved: accepted afterwards
 * - attempted: submitted, never accepted
 * - queued: in your upsolve queue, not solved yet
 * - untried: never opened
 */
export type ProblemState = "during" | "upsolved" | "attempted" | "queued" | "untried";

export type ContestProblemView = {
  id: number;
  platform: Platform;
  index: string;
  name: string;
  url: string | null;
  difficulty: number | null;
  state: ProblemState;
  solvedDuring: SolvedDuring | null;
  solvedAt: Date | null;
  tries: number;
  /** Your tracked row for this problem, if any (what the side pane edits). */
  tracked: Problem | null;
};

export type ContestView = Contest & {
  problems: ContestProblemView[];
  solved: number;
  left: number;
};

function stateOf(p: { status: Status; solvedAt: Date | null; solvedDuring: SolvedDuring | null } | null): ProblemState {
  if (!p) return "untried";
  if (p.solvedAt || p.status === "solved") {
    return p.solvedDuring === "contest" || p.solvedDuring === "virtual" ? "during" : "upsolved";
  }
  if (p.status === "upsolve") return "queued";
  return "attempted";
}

const PARTICIPATION_FILTERS = ["live", "virtual", "practice"] as const;

export const contestFiltersSchema = z.object({
  type: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : []))
    .pipe(z.array(z.enum(PARTICIPATION_FILTERS)))
    .catch([]),
  left: z.enum(["1"]).optional().catch(undefined),
  judge: z.enum(["codeforces", "atcoder"]).optional().catch(undefined),
});
export type ContestFilters = z.infer<typeof contestFiltersSchema>;

export function parseContestFilters(params: Record<string, string | string[] | undefined>) {
  return contestFiltersSchema.parse({
    type: typeof params.type === "string" ? params.type : undefined,
    left: typeof params.left === "string" ? params.left : undefined,
    judge: typeof params.judge === "string" ? params.judge : undefined,
  });
}

async function loadContests(contestId?: number): Promise<ContestView[]> {
  const rows = await db
    .select({ contest: contests, cp: contestProblems, p: problems })
    .from(contests)
    .leftJoin(contestProblems, eq(contestProblems.contestId, contests.id))
    .leftJoin(
      problems,
      and(eq(problems.platform, contests.platform), eq(problems.externalId, contestProblems.externalId)),
    )
    .where(contestId ? eq(contests.id, contestId) : undefined)
    .orderBy(desc(contests.date), desc(contests.id), asc(contestProblems.id));

  const byId = new Map<number, ContestView>();
  for (const { contest, cp, p } of rows) {
    let view = byId.get(contest.id);
    if (!view) {
      view = { ...contest, problems: [], solved: 0, left: 0 };
      byId.set(contest.id, view);
    }
    if (!cp) continue;
    const state = stateOf(p);
    view.problems.push({
      id: cp.id,
      platform: contest.platform,
      index: cp.index,
      name: cp.name,
      url: cp.url,
      difficulty: cp.difficulty,
      state,
      solvedDuring: p?.solvedDuring ?? null,
      solvedAt: p?.solvedAt ?? null,
      tries: p?.tries ?? 0,
      tracked: p,
    });
    if (state === "during" || state === "upsolved") view.solved++;
    else view.left++;
  }
  for (const view of byId.values()) {
    view.problems.sort((a, b) => a.index.localeCompare(b.index, "en", { numeric: true }));
  }
  return [...byId.values()];
}

export async function listContests(filters: ContestFilters) {
  const all = await loadContests();
  const matchesType = (c: ContestView) => {
    if (filters.type.length === 0) return true;
    const kind = c.participation === "contest" || c.participation === "unofficial" ? "live" : c.participation;
    return filters.type.includes(kind);
  };
  return {
    all,
    shown: all.filter((c) => matchesType(c) && (!filters.left || c.left > 0) && (!filters.judge || c.platform === filters.judge)),
  };
}

export async function getContest(id: number): Promise<ContestView | null> {
  const [view] = await loadContests(id);
  return view ?? null;
}
