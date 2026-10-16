import type { Participation, SolvedDuring, Status } from "../constants";

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

export type SyncedProblem = {
  externalId: string;
  name: string;
  url: string;
  difficulty: number | null;
  tags: string[];
  status: Extract<Status, "solved" | "attempted">;
  tries: number;
  solvedAt: Date | null;
  solvedDuring: SolvedDuring | null;
};

export type SyncedContestProblem = {
  index: string;
  externalId: string;
  name: string;
  url: string;
  difficulty: number | null;
  tags: string[];
};

export type SyncedContest = {
  externalId: string;
  name: string;
  url: string;
  date: Date | null;
  participation: Participation;
  rank: number | null;
  oldRating: number | null;
  newRating: number | null;
  problems: SyncedContestProblem[];
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
    });
  }
  return result;
}

const PARTICIPATION_RANK: Record<Participation, number> = {
  contest: 0,
  unofficial: 1,
  virtual: 2,
  practice: 3,
};

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

type ExistingRow = {
  name: string;
  url: string | null;
  difficulty: number | null;
  tags: string[];
  status: Status;
  tries: number;
  solvedAt: Date | null;
  solvedDuring: SolvedDuring | null;
};

export type MergedFields = ExistingRow;

/**
 * Combine judge facts with what's already tracked. The judge owns name, link,
 * rating, tries and solve date; you own notes, the editorial flag and any
 * status you set yourself, except that solving an "attempted" or "upsolve"
 * problem marks it solved.
 */
export function mergeWithExisting(incoming: SyncedProblem, existing: ExistingRow | undefined): MergedFields {
  if (!existing) {
    return {
      name: incoming.name,
      url: incoming.url,
      difficulty: incoming.difficulty,
      tags: incoming.tags,
      status: incoming.status,
      tries: incoming.tries,
      solvedAt: incoming.solvedAt,
      solvedDuring: incoming.solvedDuring,
    };
  }
  const promote = incoming.status === "solved" && (existing.status === "attempted" || existing.status === "upsolve");
  return {
    name: incoming.name,
    url: incoming.url,
    difficulty: incoming.difficulty ?? existing.difficulty,
    tags: [...new Set([...existing.tags, ...incoming.tags])],
    status: promote ? "solved" : existing.status,
    tries: incoming.tries,
    solvedAt: incoming.solvedAt ?? existing.solvedAt,
    solvedDuring: incoming.solvedDuring ?? existing.solvedDuring,
  };
}

export function hasChanges(existing: ExistingRow, merged: MergedFields): boolean {
  return (
    existing.name !== merged.name ||
    existing.url !== merged.url ||
    existing.difficulty !== merged.difficulty ||
    existing.status !== merged.status ||
    existing.tries !== merged.tries ||
    existing.solvedDuring !== merged.solvedDuring ||
    existing.solvedAt?.getTime() !== merged.solvedAt?.getTime() ||
    sameTags(existing.tags, merged.tags) === false
  );
}

export function sameTags(a: string[], b: string[]): boolean {
  return a.join("\u0000") === b.join("\u0000");
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
  const { problems: problemset } = await cfApi<{ problems: CfProblem[] }>("problemset.problems");
  return { submissions, ratingChanges, contests, problemset };
}
