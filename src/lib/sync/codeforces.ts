import type { Participation, SolvedDuring } from "../constants";
import { PARTICIPATION_RANK, sameTags, type SyncedContest, type SyncedProblem } from "./merge";

// Subsets of https://codeforces.com/apiHelp/objects that we use.
export type CfProblem = {
  contestId?: number;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
};

export type CfSubmission = {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  problem: CfProblem;
  author: { participantType: string };
  verdict?: string;
  programmingLanguage?: string;
};

export type CfRatingChange = {
  contestId: number;
  contestName: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
};

export type CfContest = {
  id: number;
  name: string;
  phase: string;
  startTimeSeconds?: number;
};

// Verdicts that don't count as an attempt (Codeforces doesn't penalise them either).
const NOT_AN_ATTEMPT = new Set(["COMPILATION_ERROR", "SKIPPED", "TESTING"]);

const GYM_ID_START = 100000;

export function problemUrl(contestId: number, index: string): string {
  return contestId >= GYM_ID_START
    ? `https://codeforces.com/gym/${contestId}/problem/${index}`
    : `https://codeforces.com/problemset/problem/${contestId}/${index}`;
}

function contestIdOf(s: CfSubmission): number | undefined {
  return s.problem.contestId ?? s.contestId;
}

function solvedDuringOf(participantType: string): SolvedDuring {
  if (participantType === "CONTESTANT" || participantType === "OUT_OF_COMPETITION") return "contest";
  if (participantType === "VIRTUAL") return "virtual";
  return "practice";
}

/** Collapse a user's submissions into one entry per problem. */
export function summarizeSubmissions(submissions: CfSubmission[]): SyncedProblem[] {
  const byProblem = new Map<string, CfSubmission[]>();
  for (const s of submissions) {
    const contestId = contestIdOf(s);
    if (!contestId || !s.verdict || NOT_AN_ATTEMPT.has(s.verdict)) continue;
    const key = `${contestId}${s.problem.index}`;
    const list = byProblem.get(key) ?? [];
    list.push(s);
    byProblem.set(key, list);
  }

  const result: SyncedProblem[] = [];
  for (const [externalId, subs] of byProblem) {
    subs.sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds || a.id - b.id);
    const firstAc = subs.findIndex((s) => s.verdict === "OK");
    // The latest submission carries the freshest metadata (rating appears after a contest ends).
    const { problem } = subs[subs.length - 1];
    const contestId = contestIdOf(subs[subs.length - 1])!;
    const ac = firstAc >= 0 ? subs[firstAc] : null;
    const latestAc = subs.findLast((s) => s.verdict === "OK") ?? null;

    result.push({
      externalId,
      name: problem.name,
      url: problemUrl(contestId, problem.index),
      difficulty: problem.rating ?? null,
      tags: problem.tags,
      status: ac ? "solved" : "attempted",
      tries: ac ? firstAc + 1 : subs.length,
      solvedAt: ac ? new Date(ac.creationTimeSeconds * 1000) : null,
      solvedDuring: ac ? solvedDuringOf(ac.author.participantType) : null,
      submissionId: latestAc?.id ?? null,
      submissionLanguage: latestAc?.programmingLanguage ?? null,
    });
  }
  return result;
}

function participationOf(participantType: string): Participation {
  if (participantType === "CONTESTANT") return "contest";
  if (participantType === "OUT_OF_COMPETITION") return "unofficial";
  if (participantType === "VIRTUAL") return "virtual";
  return "practice";
}

const byIndex = (a: { index: string }, b: { index: string }) =>
  a.index.localeCompare(b.index, "en", { numeric: true });

/**
 * Every regular (non-gym) contest you took part in, virtually joined, rated in,
 * or solved any problem from, with its full problem set.
 */
export function summarizeContests(input: {
  submissions: CfSubmission[];
  ratingChanges: CfRatingChange[];
  contests: CfContest[];
  problemset: CfProblem[];
}): SyncedContest[] {
  const participation = new Map<number, Participation>();
  const seenProblems = new Map<number, Map<string, CfProblem>>();
  for (const s of input.submissions) {
    const id = contestIdOf(s);
    if (!id || id >= GYM_ID_START) continue;
    const p = participationOf(s.author.participantType);
    const current = participation.get(id);
    if (!current || PARTICIPATION_RANK[p] < PARTICIPATION_RANK[current]) participation.set(id, p);
    const problems = seenProblems.get(id) ?? new Map();
    problems.set(s.problem.index, s.problem);
    seenProblems.set(id, problems);
  }

  const rating = new Map(input.ratingChanges.map((r) => [r.contestId, r]));
  for (const r of input.ratingChanges) {
    if (!participation.has(r.contestId)) participation.set(r.contestId, "contest");
  }

  const contestInfo = new Map(input.contests.map((c) => [c.id, c]));
  const problemsetByContest = new Map<number, CfProblem[]>();
  for (const p of input.problemset) {
    if (!p.contestId || !participation.has(p.contestId)) continue;
    const list = problemsetByContest.get(p.contestId) ?? [];
    list.push(p);
    problemsetByContest.set(p.contestId, list);
  }

  const result: SyncedContest[] = [];
  for (const [id, how] of participation) {
    // The problemset is authoritative; problems only seen in your submissions
    // fill gaps (e.g. a contest that ended minutes ago).
    const problems = new Map<string, CfProblem>();
    for (const p of seenProblems.get(id)?.values() ?? []) problems.set(p.index, p);
    for (const p of problemsetByContest.get(id) ?? []) problems.set(p.index, p);

    const info = contestInfo.get(id);
    const r = rating.get(id);
    result.push({
      externalId: String(id),
      name: info?.name ?? r?.contestName ?? `Contest ${id}`,
      url: `https://codeforces.com/contest/${id}`,
      date: info?.startTimeSeconds ? new Date(info.startTimeSeconds * 1000) : null,
      participation: how,
      rank: r?.rank ?? null,
      oldRating: r?.oldRating ?? null,
      newRating: r?.newRating ?? null,
      problems: [...problems.values()].sort(byIndex).map((p) => ({
        index: p.index,
        externalId: `${id}${p.index}`,
        name: p.name,
        url: problemUrl(id, p.index),
        difficulty: p.rating ?? null,
        tags: p.tags,
      })),
    });
  }
  return result;
}

// Codeforces allows one API call every two seconds per client.
const MIN_INTERVAL_MS = 2100;
let lastCallAt = 0;

async function cfApi<T>(method: string, params: Record<string, string> = {}): Promise<T> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://codeforces.com/api/${method}${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => null)) as
    | { status: "OK"; result: T }
    | { status: "FAILED"; comment: string }
    | null;
  if (!body) throw new Error(`Codeforces returned HTTP ${res.status}. Try again in a minute.`);
  if (body.status !== "OK") throw new Error(`Codeforces: ${body.comment}`);
  return body.result;
}

export async function fetchAll(handle: string) {
  const submissions = await cfApi<CfSubmission[]>("user.status", { handle });
  const ratingChanges = await cfApi<CfRatingChange[]>("user.rating", { handle });
  const contests = await cfApi<CfContest[]>("contest.list", { gym: "false" });
  const { problems: problemset, problemStatistics } = await cfApi<{
    problems: CfProblem[];
    problemStatistics: CfProblemStatistics[];
  }>("problemset.problems");
  return { submissions, ratingChanges, contests, problemset, problemStatistics };
}

export type CfProblemStatistics = { contestId?: number; index: string; solvedCount: number };

export type CatalogEntry = {
  externalId: string;
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  solvedCount: number;
};

/** The problemset joined with how many people solved each problem. */
export function buildCatalog(problems: CfProblem[], stats: CfProblemStatistics[]): CatalogEntry[] {
  const solved = new Map(stats.map((s) => [`${s.contestId}${s.index}`, s.solvedCount]));
  return problems.flatMap((p) => {
    if (!p.contestId) return [];
    const externalId = `${p.contestId}${p.index}`;
    return [{
      externalId,
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating ?? null,
      tags: p.tags,
      solvedCount: solved.get(externalId) ?? 0,
    }];
  });
}

/** Solve counts drift constantly; only rewrite a row when something meaningful changed. */
export function catalogEntryChanged(
  existing: Omit<CatalogEntry, "externalId" | "contestId" | "index">,
  next: CatalogEntry,
): boolean {
  return (
    existing.name !== next.name ||
    existing.rating !== next.rating ||
    !sameTags(existing.tags, next.tags) ||
    Math.abs(next.solvedCount - existing.solvedCount) > Math.max(50, existing.solvedCount * 0.1)
  );
}
