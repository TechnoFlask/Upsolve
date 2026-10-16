import type { Participation, SolvedDuring } from "../constants";
import { PARTICIPATION_RANK, type SyncedContest, type SyncedContestProblem, type SyncedProblem } from "./merge";

// Subsets of the AtCoder Problems datasets (https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md)
// and of atcoder.jp's own contest history, that we use.
export type AcSubmission = {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  language: string;
  result: string;
};

export type AcProblem = {
  id: string;
  contest_id: string;
  problem_index: string;
  name: string;
  solver_count: number | null;
};

export type AcModel = { difficulty?: number };

export type AcContest = {
  id: string;
  start_epoch_second: number;
  duration_second: number;
  title: string;
};

export type AcContestProblem = { contest_id: string; problem_id: string; problem_index: string };

/** One row of atcoder.jp/users/{user}/history/json. */
export type AcHistory = {
  IsRated: boolean;
  Place: number;
  OldRating: number;
  NewRating: number;
  ContestScreenName: string;
  ContestName: string;
  /** Empty when the contest has no separate English name. */
  ContestNameEn: string;
  EndTime: string;
};

export type AtCoderData = {
  submissions: AcSubmission[];
  history: AcHistory[];
  problems: AcProblem[];
  models: Record<string, AcModel>;
  contests: AcContest[];
  contestProblems: AcContestProblem[];
};

// Verdicts that count as an attempt. Compile errors, internal errors and
// submissions still being judged (WJ, WR, "3/12") don't.
const COUNTED = new Set(["AC", "WA", "TLE", "MLE", "RE", "OLE", "QLE"]);

// Practice sets like APG4b or "abs" are open for years; they aren't contests.
const PERMANENT_AFTER_SECONDS = 30 * 86_400;

export function problemUrl(contestId: string, problemId: string): string {
  return `https://atcoder.jp/contests/${contestId}/tasks/${problemId}`;
}

/**
 * AtCoder Problems' display rule: estimates below 400 are squashed towards 0
 * so they stay positive (an estimate of -848 shows as 18).
 */
export function clipDifficulty(raw: number): number {
  return Math.round(raw >= 400 ? raw : 400 / Math.exp((400 - raw) / 400));
}

function difficultyOf(models: Record<string, AcModel>, problemId: string): number | null {
  const raw = models[problemId]?.difficulty;
  return raw == null ? null : clipDifficulty(raw);
}

const isPermanent = (c: AcContest) => c.start_epoch_second === 0 || c.duration_second >= PERMANENT_AFTER_SECONDS;

/** True when the submission was made while its contest was running. */
function duringContest(s: AcSubmission, contests: Map<string, AcContest>): boolean {
  const c = contests.get(s.contest_id);
  if (!c || isPermanent(c)) return false;
  return s.epoch_second >= c.start_epoch_second && s.epoch_second < c.start_epoch_second + c.duration_second;
}

/** "abc350.contest.atcoder.jp" → "abc350" */
export const historyContestId = (h: AcHistory) => h.ContestScreenName.split(".")[0];

const JAPANESE = /[\u3040-\u30ff\u4e00-\u9fff]/;

/**
 * Sponsored rounds are titled in Japanese with the English name in full-width
 * brackets: "オムロンプログラミングコンテスト2026 （AtCoder Beginner Contest 479）".
 * Prefer AtCoder's own English name, then that bracketed part.
 */
export function contestName(id: string, info: AcContest | undefined, h: AcHistory | undefined): string {
  if (h?.ContestNameEn) return h.ContestNameEn;
  const title = info?.title ?? h?.ContestName;
  if (!title) return id;
  const english = JAPANESE.test(title) ? /（([^（）]*[A-Za-z][^（）]*)）\s*$/.exec(title)?.[1] : undefined;
  return english?.trim() || title;
}

/** "abc350_c" → "C", for problems the datasets haven't caught up with yet. */
const indexFromId = (problemId: string) => (problemId.split("_").at(-1) ?? problemId).toUpperCase();

/** Collapse a user's submissions into one entry per problem. */
export function summarizeSubmissions(data: Pick<AtCoderData, "submissions" | "problems" | "models" | "contests">): SyncedProblem[] {
  const problems = new Map(data.problems.map((p) => [p.id, p]));
  const contests = new Map(data.contests.map((c) => [c.id, c]));

  const byProblem = new Map<string, AcSubmission[]>();
  for (const s of data.submissions) {
    if (!COUNTED.has(s.result)) continue;
    const list = byProblem.get(s.problem_id) ?? [];
    list.push(s);
    byProblem.set(s.problem_id, list);
  }

  const result: SyncedProblem[] = [];
  for (const [problemId, subs] of byProblem) {
    subs.sort((a, b) => a.epoch_second - b.epoch_second || a.id - b.id);
    const firstAc = subs.findIndex((s) => s.result === "AC");
    const ac = firstAc >= 0 ? subs[firstAc] : null;
    const latestAc = subs.findLast((s) => s.result === "AC") ?? null;
    const info = problems.get(problemId);
    const solvedDuring: SolvedDuring | null = ac ? (duringContest(ac, contests) ? "contest" : "practice") : null;

    result.push({
      externalId: problemId,
      name: info?.name ?? problemId,
      // Shared ABC/ARC problems live under several contests; link the one you
      // last solved it in, so the submission link (same contest) resolves too.
      url: problemUrl((latestAc ?? subs[subs.length - 1]).contest_id, problemId),
      difficulty: difficultyOf(data.models, problemId),
      tags: [],
      status: ac ? "solved" : "attempted",
      tries: ac ? firstAc + 1 : subs.length,
      solvedAt: ac ? new Date(ac.epoch_second * 1000) : null,
      solvedDuring,
      submissionId: latestAc?.id ?? null,
      submissionLanguage: latestAc?.language ?? null,
    });
  }
  return result;
}

const byIndex = (a: { index: string }, b: { index: string }) =>
  a.index.localeCompare(b.index, "en", { numeric: true });

/**
 * Every contest you took part in (rated or not) or solved any problem from,
 * with its full problem set. Long-running practice sets are left out.
 */
export function summarizeContests(data: AtCoderData): SyncedContest[] {
  const contests = new Map(data.contests.map((c) => [c.id, c]));
  const participation = new Map<string, Participation>();
  const take = (id: string, how: Participation) => {
    const current = participation.get(id);
    if (!current || PARTICIPATION_RANK[how] < PARTICIPATION_RANK[current]) participation.set(id, how);
  };

  const history = new Map(data.history.map((h) => [historyContestId(h), h]));
  for (const [id, h] of history) take(id, h.IsRated ? "contest" : "unofficial");

  const seen = new Map<string, Set<string>>();
  for (const s of data.submissions) {
    if (!COUNTED.has(s.result)) continue;
    take(s.contest_id, duringContest(s, contests) ? "contest" : "practice");
    const ids = seen.get(s.contest_id) ?? new Set();
    ids.add(s.problem_id);
    seen.set(s.contest_id, ids);
  }

  const problems = new Map(data.problems.map((p) => [p.id, p]));
  const setByContest = new Map<string, AcContestProblem[]>();
  for (const cp of data.contestProblems) {
    if (!participation.has(cp.contest_id)) continue;
    const list = setByContest.get(cp.contest_id) ?? [];
    list.push(cp);
    setByContest.set(cp.contest_id, list);
  }

  const result: SyncedContest[] = [];
  for (const [id, how] of participation) {
    const info = contests.get(id);
    if (info && isPermanent(info)) continue;
    const h = history.get(id);

    // The contest's own problem list is authoritative; problems only seen in
    // your submissions fill gaps (a contest that ended an hour ago).
    const set = new Map<string, SyncedContestProblem>();
    const add = (problemId: string, index: string) =>
      set.set(problemId, {
        index,
        externalId: problemId,
        name: problems.get(problemId)?.name ?? problemId,
        url: problemUrl(id, problemId),
        difficulty: difficultyOf(data.models, problemId),
        tags: [],
      });
    for (const problemId of seen.get(id) ?? []) add(problemId, indexFromId(problemId));
    for (const cp of setByContest.get(id) ?? []) add(cp.problem_id, cp.problem_index);

    result.push({
      externalId: id,
      name: contestName(id, info, h),
      url: `https://atcoder.jp/contests/${id}`,
      date: info ? new Date(info.start_epoch_second * 1000) : h ? new Date(h.EndTime) : null,
      participation: how,
      rank: h?.Place ?? null,
      oldRating: h?.IsRated ? h.OldRating : null,
      newRating: h?.IsRated ? h.NewRating : null,
      problems: [...set.values()].sort(byIndex),
    });
  }
  return result;
}

const KENKOOOO = "https://kenkoooo.com/atcoder";
const PAGE_SIZE = 500;

// AtCoder Problems asks clients to leave more than a second between calls.
const MIN_INTERVAL_MS = 1100;
let lastCallAt = 0;

async function getJson<T>(url: string): Promise<T> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Upsolve (personal progress tracker)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AtCoder data from ${new URL(url).host} returned HTTP ${res.status}. Try again in a minute.`);
  return (await res.json()) as T;
}

async function fetchSubmissions(handle: string): Promise<AcSubmission[]> {
  const all = new Map<number, AcSubmission>();
  let from = 0;
  for (;;) {
    const page = await getJson<AcSubmission[]>(
      `${KENKOOOO}/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${from}`,
    );
    for (const s of page) all.set(s.id, s);
    if (page.length < PAGE_SIZE) break;
    // Start the next page at the last second seen; duplicates collapse by id.
    const last = Math.max(...page.map((s) => s.epoch_second));
    if (last === from) break;
    from = last;
  }
  return [...all.values()];
}

export async function fetchAll(handle: string): Promise<AtCoderData> {
  const submissions = await fetchSubmissions(handle);
  const history = await getJson<AcHistory[]>(`https://atcoder.jp/users/${encodeURIComponent(handle)}/history/json`);
  const merged = await getJson<AcProblem[]>(`${KENKOOOO}/resources/merged-problems.json`);
  const models = await getJson<Record<string, AcModel>>(`${KENKOOOO}/resources/problem-models.json`);
  const contests = await getJson<AcContest[]>(`${KENKOOOO}/resources/contests.json`);
  const contestProblems = await getJson<AcContestProblem[]>(`${KENKOOOO}/resources/contest-problem.json`);
  return {
    submissions,
    history,
    // merged-problems carries a lot of fastest/shortest-submission trivia we don't keep.
    problems: merged.map((p) => ({
      id: p.id,
      contest_id: p.contest_id,
      problem_index: p.problem_index,
      name: p.name,
      solver_count: p.solver_count ?? null,
    })),
    models,
    contests,
    contestProblems,
  };
}
