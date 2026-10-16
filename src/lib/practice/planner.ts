// The daily practice planner. Pure and deterministic (seeded by the day), so the
// AI only ever chooses among real problems this code has already vetted.
import type { PracticeSlot } from "@/db/schema";
import type { Status } from "@/lib/constants";
import { addDays, tagStats } from "@/lib/stats";

export const MIN_LEVEL = 800;
export const MAX_LEVEL = 3500;

export type HistoryProblem = {
  platform: string;
  externalId: string;
  name: string;
  difficulty: number | null;
  tags: string[];
  status: Status;
  tries: number;
  solvedAt: Date | null;
  usedEditorial: boolean;
  url: string | null;
};

export type CatalogProblem = {
  externalId: string;
  contestId: number;
  name: string;
  rating: number | null;
  tags: string[];
  solvedCount: number;
};

export type PastItem = {
  day: string;
  planLevel: number;
  slot: PracticeSlot;
  externalId: string;
  name: string;
  url: string | null;
  difficulty: number | null;
  tags: string[];
};

export type Outcome = "clean" | "editorial" | "attempted" | "untouched";

const round100 = (n: number) => Math.round(n / 100) * 100;
const clampLevel = (n: number) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n));
const solved = (p: Pick<HistoryProblem, "status" | "solvedAt">) => p.status === "solved" || p.solvedAt != null;

// ---------------------------------------------------------------- level

/** The rating you solve comfortably: 75th percentile of recent no-editorial solves. */
export function estimateLevel(history: HistoryProblem[], now: Date): number {
  const clean = history.filter(
    (p) => p.platform === "codeforces" && p.difficulty != null && solved(p) && !p.usedEditorial,
  );
  const cutoff = now.getTime() - 60 * 24 * 60 * 60 * 1000;
  const recent = clean.filter((p) => p.solvedAt && p.solvedAt.getTime() >= cutoff);
  const pool = (recent.length >= 5 ? recent : clean).map((p) => p.difficulty!).sort((a, b) => a - b);
  if (pool.length === 0) return MIN_LEVEL;
  const p75 = pool[Math.min(pool.length - 1, Math.floor(pool.length * 0.75))];
  return clampLevel(round100(p75));
}

export function outcomeOf(p: Pick<HistoryProblem, "status" | "solvedAt" | "usedEditorial" | "tries"> | undefined): Outcome {
  if (!p) return "untouched";
  if (solved(p)) return p.usedEditorial ? "editorial" : "clean";
  return p.tries > 0 || p.status === "attempted" ? "attempted" : "untouched";
}

/**
 * Move the level by ±100 based on how the last few days' growth problems went.
 * Untouched problems don't count: skipping a day isn't failing it.
 */
export function adaptLevel(input: {
  estimate: number;
  previousLevel: number | null;
  recentGrowthOutcomes: { slot: PracticeSlot; outcome: Outcome }[];
}): { level: number; change: -100 | 0 | 100; reason: string } {
  const base = input.previousLevel ?? input.estimate;
  const scored = input.recentGrowthOutcomes.filter((o) => o.outcome !== "untouched");
  let change: -100 | 0 | 100 = 0;
  let reason = input.previousLevel == null ? "Starting from the problems you've solved recently." : "Holding steady.";
  if (scored.length >= 3) {
    const points = scored.reduce((s, o) => {
      const value = o.outcome === "clean" ? 1 : o.outcome === "editorial" ? 0.5 : 0;
      return s + (o.slot === "stretch" ? value * 1.5 : value);
    }, 0);
    const rate = points / scored.length;
    if (rate >= 0.75) {
      change = 100;
      reason = "You've been solving your growth problems cleanly, so the bar goes up.";
    } else if (rate <= 0.3) {
      change = -100;
      reason = "The last few growth problems were a struggle, so we're consolidating a step lower.";
    }
  }
  const level = clampLevel(Math.max(base + change, input.estimate));
  if (level > base + change) reason = "Your recent solves show you're comfortable higher than the last plan.";
  return { level, change: (level - base > 0 ? 100 : level - base < 0 ? -100 : 0) as -100 | 0 | 100, reason };
}

// ---------------------------------------------------------------- topics

const CURRICULUM: { from: number; tags: string[] }[] = [
  { from: 0, tags: ["implementation", "math", "greedy", "brute force", "constructive algorithms", "sortings", "strings"] },
  { from: 1200, tags: ["binary search", "two pointers", "number theory", "dp", "data structures", "bitmasks"] },
  { from: 1600, tags: ["graphs", "dfs and similar", "trees", "combinatorics", "dsu", "shortest paths"] },
  { from: 2000, tags: ["divide and conquer", "hashing", "probabilities", "geometry", "games"] },
];

export function curriculumFor(level: number): string[] {
  return CURRICULUM.filter((c) => level >= c.from).flatMap((c) => c.tags);
}

/**
 * The topic to work on today: a tag you're struggling with if there is one,
 * otherwise the level-appropriate topic you've practised least.
 */
export function chooseFocusTags(history: HistoryProblem[], level: number, count: number, seed: number): string[] {
  const curriculum = curriculumFor(level);
  const stats = tagStats(
    history.map((p) => ({ ...p, platform: p.platform as "codeforces" })),
  );
  const byTag = new Map(stats.map((s) => [s.tag, s]));
  const weak = stats
    .filter((s) => s.weak && curriculum.includes(s.tag))
    .sort((a, b) => a.solved / (a.solved + a.unsolved) - b.solved / (b.solved + b.unsolved))
    .map((s) => s.tag);
  const leastPractised = shuffle(curriculum, seed)
    .filter((t) => !weak.includes(t))
    .sort((a, b) => (byTag.get(a)?.solved ?? 0) - (byTag.get(b)?.solved ?? 0));
  return [...weak, ...leastPractised].slice(0, count);
}

// ---------------------------------------------------------------- slots

export type SlotSpec = {
  slot: PracticeSlot;
  target: number;
  focusTag: string | null;
  optional: boolean;
};

export const PLAN_SIZES = { 3: "Light", 5: "Regular", 7: "Intense" } as const;
export type PlanSize = keyof typeof PLAN_SIZES;

export function slotsFor(size: PlanSize, level: number, focusTags: string[], hasUpsolve: boolean): SlotSpec[] {
  const at = (n: number) => clampLevel(level + n);
  const spec = (slot: PracticeSlot, target: number, focusTag: string | null = null, optional = false): SlotSpec => ({
    slot,
    target,
    focusTag,
    optional,
  });
  const slots: SlotSpec[] =
    size === 3
      ? [spec("warmup", at(0)), spec("core", at(100)), spec("weak", at(0), focusTags[0] ?? null)]
      : size === 5
        ? [spec("warmup", at(0)), spec("core", at(100)), spec("core", at(200)), spec("weak", at(0), focusTags[0] ?? null), spec("stretch", at(300))]
        : [
            spec("warmup", at(0)),
            spec("core", at(100)),
            spec("core", at(100)),
            spec("core", at(200)),
            spec("weak", at(0), focusTags[0] ?? null),
            spec("weak", at(100), focusTags[1] ?? focusTags[0] ?? null),
            spec("stretch", at(300)),
          ];
  if (hasUpsolve && size !== 3) slots.push(spec("upsolve", at(300), null, true));
  return slots;
}

// ---------------------------------------------------------------- candidates

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type Candidate = {
  externalId: string;
  name: string;
  url: string;
  rating: number | null;
  tags: string[];
  solvedCount: number;
  /** For upsolve candidates: why it's back. */
  note?: string;
};

const catalogUrl = (p: CatalogProblem) =>
  `https://codeforces.com/problemset/problem/${p.contestId}/${p.externalId.slice(String(p.contestId).length)}`;

/**
 * Fresh problems for a slot: exactly the target rating, never tracked or
 * suggested before, ranked by popularity and recency, lightly shuffled per day.
 */
export function freshCandidates(input: {
  catalog: CatalogProblem[];
  spec: SlotSpec;
  exclude: Set<string>;
  excludeNames: Set<string>;
  seed: number;
  count?: number;
}): Candidate[] {
  const { spec } = input;
  const maxContest = input.catalog.reduce((m, p) => Math.max(m, p.contestId), 1);
  const pool = input.catalog.filter(
    (p) =>
      p.rating === spec.target &&
      !p.tags.includes("*special") &&
      !input.exclude.has(p.externalId) &&
      !input.excludeNames.has(p.name.toLowerCase()) &&
      (!spec.focusTag || p.tags.includes(spec.focusTag)),
  );
  const scored = pool
    .map((p) => ({ p, score: Math.log10(p.solvedCount + 1) + 1.5 * (p.contestId / maxContest) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
  const seen = new Set<string>();
  return shuffle(scored, input.seed)
    .filter(({ p }) => (seen.has(p.name.toLowerCase()) ? false : (seen.add(p.name.toLowerCase()), true)))
    .slice(0, input.count ?? 6)
    .map(({ p }) => ({
      externalId: p.externalId,
      name: p.name,
      url: catalogUrl(p),
      rating: p.rating,
      tags: p.tags,
      solvedCount: p.solvedCount,
    }));
}

/**
 * Unfinished business, most valuable first: earlier plan problems you attempted
 * but didn't solve, then your upsolve queue, then other attempted problems.
 */
export function upsolveCandidates(input: {
  history: HistoryProblem[];
  pastItems: PastItem[];
  level: number;
  today: string;
  exclude: Set<string>;
}): Candidate[] {
  const byId = new Map(input.history.map((p) => [p.externalId, p]));
  const limit = input.level + 300;
  const out: Candidate[] = [];
  const push = (c: Candidate) => {
    if (!input.exclude.has(c.externalId) && !out.some((o) => o.externalId === c.externalId)) out.push(c);
  };
  for (const item of [...input.pastItems].sort((a, b) => b.day.localeCompare(a.day))) {
    const p = byId.get(item.externalId);
    if (item.day >= input.today || outcomeOf(p) !== "attempted") continue;
    if (item.difficulty != null && item.difficulty > limit) continue;
    push({ externalId: item.externalId, name: item.name, url: item.url ?? "", rating: item.difficulty, tags: item.tags, solvedCount: 0, note: `From your ${item.day} plan, attempted but not solved yet.` });
  }
  for (const status of ["upsolve", "attempted"] as const) {
    for (const p of input.history) {
      if (p.platform !== "codeforces" || p.status !== status || solved(p)) continue;
      if (p.difficulty != null && p.difficulty > limit) continue;
      push({
        externalId: p.externalId,
        name: p.name,
        url: p.url ?? "",
        rating: p.difficulty,
        tags: p.tags,
        solvedCount: 0,
        note: status === "upsolve" ? "In your upsolve queue." : `You tried this ${p.tries} ${p.tries === 1 ? "time" : "times"} without getting it accepted.`,
      });
    }
  }
  return out.slice(0, 6);
}

// ---------------------------------------------------------------- picking

export type SlotWithCandidates = SlotSpec & { candidates: Candidate[] };

export type PlanPick = SlotWithCandidates & { choice: Candidate; reason: string };

export const SLOT_LABEL: Record<PracticeSlot, string> = {
  warmup: "Warm-up",
  core: "Core",
  weak: "Weak spot",
  stretch: "Stretch",
  upsolve: "Upsolve",
};

export function templateReason(slot: SlotSpec, c: Candidate, level: number): string {
  switch (slot.slot) {
    case "warmup":
      return `A ${c.rating} to get going: right at your level, so aim to solve it quickly and cleanly.`;
    case "core":
      return `${c.rating} is ${(c.rating ?? level) - level} above your level, in the zone where you grow. Give it a real try before reaching for the editorial.`;
    case "weak":
      return `Practice for ${slot.focusTag ?? "a weaker topic"}, kept at ${c.rating} so the idea is the challenge, not the difficulty.`;
    case "stretch":
      return `A ${c.rating} stretch. It's fine not to finish it today; thinking hard about it is the point.`;
    case "upsolve":
      return c.note ?? "Something you didn't finish earlier. Worth another go.";
  }
}

/** Deterministic fallback: best candidate per slot, keeping tags varied across slots. */
export function pickDeterministically(slots: SlotWithCandidates[], level: number): PlanPick[] {
  const used = new Set<string>();
  const usedTags = new Map<string, number>();
  const picks: PlanPick[] = [];
  for (const slot of slots) {
    const options = slot.candidates.filter((c) => !used.has(c.externalId));
    if (options.length === 0) continue;
    const choice = [...options].sort(
      (a, b) =>
        a.tags.reduce((s, t) => s + (usedTags.get(t) ?? 0), 0) - b.tags.reduce((s, t) => s + (usedTags.get(t) ?? 0), 0),
    )[0];
    used.add(choice.externalId);
    for (const t of choice.tags) usedTags.set(t, (usedTags.get(t) ?? 0) + 1);
    picks.push({ ...slot, choice, reason: templateReason(slot, choice, level) });
  }
  return picks;
}

export function recentDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, -i - 1));
}
