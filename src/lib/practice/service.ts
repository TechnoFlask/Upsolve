import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  contests,
  practiceItems,
  practicePlans,
  problems,
  problemset,
  type PracticeItem,
  type PracticePlan,
  type Problem,
} from "@/db/schema";
import { coachPicks, type CoachProfile } from "@/lib/ai/coach";
import { aiConfigured, describeAiError } from "@/lib/ai/model";
import { toDateInput } from "@/lib/dates";
import { addDays, tagStats } from "@/lib/stats";
import { syncCodeforces } from "@/lib/sync/run";
import {
  adaptLevel,
  chooseFocusTags,
  estimateLevel,
  freshCandidates,
  hashSeed,
  outcomeOf,
  pickDeterministically,
  slotsFor,
  templateReason,
  upsolveCandidates,
  type Outcome,
  type PastItem,
  type PlanPick,
  type PlanSize,
  type SlotSpec,
  type SlotWithCandidates,
} from "./planner";

export const today = () => toDateInput(new Date());

export type PlanItemView = PracticeItem & { tracked: Problem | null; outcome: Outcome };
export type PlanView = PracticePlan & { items: PlanItemView[]; done: number };

async function viewPlans(plans: PracticePlan[]): Promise<PlanView[]> {
  if (plans.length === 0) return [];
  const items = await db
    .select({ item: practiceItems, tracked: problems })
    .from(practiceItems)
    .leftJoin(problems, and(eq(problems.platform, practiceItems.platform), eq(problems.externalId, practiceItems.externalId)))
    .where(inArray(practiceItems.planId, plans.map((p) => p.id)))
    .orderBy(practiceItems.position);
  return plans.map((plan) => {
    const mine = items
      .filter((r) => r.item.planId === plan.id)
      .map((r) => ({ ...r.item, tracked: r.tracked, outcome: outcomeOf(r.tracked ?? undefined) }));
    return { ...plan, items: mine, done: mine.filter((i) => i.outcome === "clean" || i.outcome === "editorial").length };
  });
}

export async function getPlan(day: string): Promise<PlanView | null> {
  const plan = await db.query.practicePlans.findFirst({ where: eq(practicePlans.day, day) });
  return plan ? (await viewPlans([plan]))[0] : null;
}

export async function recentPlans(beforeDay: string, limit = 14): Promise<PlanView[]> {
  const plans = await db.query.practicePlans.findMany({
    where: (p, { lt }) => lt(p.day, beforeDay),
    orderBy: [desc(practicePlans.day)],
    limit,
  });
  return viewPlans(plans);
}

export async function codeforcesHandle(): Promise<string | null> {
  const row = await db.query.accounts.findFirst({ where: eq(accounts.platform, "codeforces") });
  return row?.handle ?? null;
}

async function loadContext(day: string) {
  const [history, pastPlans, ratingRow] = await Promise.all([
    db.select().from(problems),
    db.query.practicePlans.findMany({
      where: (p, { gte: g, lt }) => and(g(p.day, addDays(day, -60)), lt(p.day, day)),
      orderBy: [desc(practicePlans.day)],
    }),
    db
      .select({ rating: contests.newRating })
      .from(contests)
      .where(and(eq(contests.platform, "codeforces"), isNotNull(contests.newRating)))
      .orderBy(desc(contests.date))
      .limit(1),
  ]);
  const pastRows = pastPlans.length
    ? await db.select().from(practiceItems).where(inArray(practiceItems.planId, pastPlans.map((p) => p.id)))
    : [];
  const planById = new Map(pastPlans.map((p) => [p.id, p]));
  const pastItems: PastItem[] = pastRows.map((r) => ({
    day: planById.get(r.planId)!.day,
    planLevel: planById.get(r.planId)!.level,
    slot: r.slot,
    externalId: r.externalId,
    name: r.name,
    url: r.url,
    difficulty: r.difficulty,
    tags: r.tags,
  }));
  return { history, pastPlans, pastItems, rating: ratingRow[0]?.rating ?? null };
}

async function catalogAt(targets: number[]) {
  return db
    .select()
    .from(problemset)
    .where(and(eq(problemset.platform, "codeforces"), inArray(problemset.rating, [...new Set(targets)])));
}

function exclusions(history: Problem[], pastItems: PastItem[], extra: string[] = []) {
  return {
    exclude: new Set([...history.map((p) => p.externalId), ...pastItems.map((i) => i.externalId), ...extra]),
    excludeNames: new Set(history.map((p) => p.name.toLowerCase())),
  };
}

export type GenerateResult = { plan: PlanView; aiError: string | null };

/** Sync, work out today's level and slots, let the coach choose, save. */
export async function generatePlan(size: PlanSize): Promise<GenerateResult> {
  const day = today();
  const existing = await getPlan(day);
  if (existing) return { plan: existing, aiError: null };

  const handle = await codeforcesHandle();
  if (!handle) throw new Error("Connect your Codeforces handle on the Sync page first.");
  await syncCodeforces(handle);

  const { history, pastPlans, pastItems, rating } = await loadContext(day);
  const seed = hashSeed(day);

  // Level: estimate from solves, then adapt using the last three plans at the current level.
  const estimate = estimateLevel(history, new Date());
  const previous = pastPlans[0] ?? null;
  const byId = new Map(history.map((p) => [p.externalId, p]));
  const recentGrowth = pastItems
    .filter((i) => previous && i.planLevel === previous.level && pastPlans.slice(0, 3).some((p) => p.day === i.day))
    .filter((i) => i.slot === "core" || i.slot === "stretch")
    .map((i) => ({ slot: i.slot, outcome: outcomeOf(byId.get(i.externalId)) }));
  const { level, reason: levelReason } = adaptLevel({ estimate, previousLevel: previous?.level ?? null, recentGrowthOutcomes: recentGrowth });

  // Slots and shortlists.
  const focusTags = chooseFocusTags(history, level, 2, seed);
  const { exclude, excludeNames } = exclusions(history, pastItems);
  const upsolve = upsolveCandidates({ history, pastItems, level, today: day, exclude: new Set() });
  const specs = slotsFor(size, level, focusTags, upsolve.length > 0);
  const catalog = await catalogAt(specs.map((s) => s.target));

  const slots: SlotWithCandidates[] = specs.map((spec, i) => ({
    ...spec,
    candidates:
      spec.slot === "upsolve"
        ? upsolve
        : freshCandidates({ catalog, spec, exclude, excludeNames, seed: seed + i }),
  }));

  // Coach (AI) with a deterministic fallback.
  let picks: PlanPick[];
  let theme: string | null = null;
  let coachNote: string | null = null;
  let model: string | null = null;
  let aiError: string | null = null;
  if (aiConfigured()) {
    try {
      const profile: CoachProfile = {
        level,
        levelReason,
        rating,
        totalSolved: history.filter((p) => p.status === "solved" || p.solvedAt).length,
        weakTags: tagStats(history).filter((t) => t.weak).map((t) => t.tag),
        recentDays: (await viewPlans(pastPlans.slice(0, 5))).map(
          (p) => `${p.day}, level ${p.level}: ${p.items.map((i) => `${i.slot} ${i.difficulty ?? "?"} ${i.outcome}`).join("; ")}`,
        ),
      };
      ({ picks, theme, coachNote, model } = await coachPicks(profile, slots));
    } catch (e) {
      aiError = describeAiError(e);
      picks = pickDeterministically(slots, level);
    }
  } else {
    picks = pickDeterministically(slots, level);
  }
  if (picks.length === 0) throw new Error("Couldn't find suitable problems. Try syncing again.");

  const [plan] = await db
    .insert(practicePlans)
    .values({ day, level, size, theme, coachNote: coachNote ?? levelReason, model })
    .returning();
  await db.insert(practiceItems).values(
    picks.map((p, position) => ({
      planId: plan.id,
      position,
      slot: p.slot,
      platform: "codeforces" as const,
      externalId: p.choice.externalId,
      name: p.choice.name,
      url: p.choice.url || null,
      difficulty: p.choice.rating,
      tags: p.choice.tags,
      reason: p.reason,
      focusTag: p.focusTag,
    })),
  );
  return { plan: (await getPlan(day))!, aiError };
}

/** Replace one not-yet-started problem with another that fits the same slot. */
export async function swapItem(itemId: number): Promise<void> {
  const item = await db.query.practiceItems.findFirst({ where: eq(practiceItems.id, itemId) });
  if (!item) throw new Error("That suggestion no longer exists.");
  const plan = await db.query.practicePlans.findFirst({ where: eq(practicePlans.id, item.planId) });
  if (!plan) throw new Error("That plan no longer exists.");

  const { history, pastItems } = await loadContext(addDays(plan.day, 1));
  if (outcomeOf(history.find((p) => p.externalId === item.externalId)) !== "untouched") {
    throw new Error("You've already started this one, so it stays.");
  }
  const spec: SlotSpec = { slot: item.slot, target: item.difficulty ?? plan.level, focusTag: item.focusTag, optional: item.slot === "upsolve" };
  const { exclude, excludeNames } = exclusions(history, pastItems, [item.externalId]);
  const seed = hashSeed(`${plan.day}:${itemId}:${Date.now()}`);
  const candidates =
    item.slot === "upsolve"
      ? upsolveCandidates({ history, pastItems, level: plan.level, today: plan.day, exclude })
      : freshCandidates({ catalog: await catalogAt([spec.target]), spec, exclude, excludeNames, seed, count: 1 });
  const next = candidates[0];
  if (!next) throw new Error("No other problem fits this slot right now.");

  await db
    .update(practiceItems)
    .set({
      externalId: next.externalId,
      name: next.name,
      url: next.url || null,
      difficulty: next.rating,
      tags: next.tags,
      reason: templateReason(spec, next, plan.level),
    })
    .where(eq(practiceItems.id, itemId));
}

export async function syncProgress(): Promise<void> {
  const handle = await codeforcesHandle();
  if (!handle) throw new Error("Connect your Codeforces handle on the Sync page first.");
  await syncCodeforces(handle);
}
