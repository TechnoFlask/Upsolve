import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  pickDeterministically,
  SLOT_LABEL,
  templateReason,
  type PlanPick,
  type SlotWithCandidates,
} from "@/lib/practice/planner";
import { defaultModel, type ModelChoice } from "./model";

export type CoachProfile = {
  level: number;
  levelReason: string;
  rating: number | null;
  totalSolved: number;
  recentDays: string[];
  weakTags: string[];
};

const coachSchema = z.object({
  theme: z.string(),
  coachNote: z.string(),
  picks: z.array(
    z.object({
      slot: z.number().int(),
      problemId: z.string(),
      reason: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `You are a competitive-programming coach planning one day of Codeforces practice for a single student who wants to improve steadily.

For each numbered slot you get a shortlist of real problems. Choose exactly one problem per slot, using only IDs from that slot's shortlist, and never the same problem twice.

How to choose:
- Across the day, vary the topics so it isn't all the same kind of problem.
- Core and stretch slots are for growth: prefer problems that teach a reusable idea for the student's level over ad-hoc tricks.
- Weak-spot slots must exercise the named focus topic.
- Upsolve slots are problems the student didn't finish before; pick the one most worth revisiting now.

Write:
- theme: a short plain phrase naming today's focus (e.g. "Greedy choices and prefix sums"). No emoji.
- coachNote: 2–3 sentences to the student, in second person: how they're doing based on the profile, and what today is for. Be honest and specific, and don't gush.
- reason (per pick): one or two sentences, under 40 words, on why this problem helps them now. Never reveal the solution, the key observation or the algorithm needed; the topic tags are fine to mention.`;

export function buildCoachPrompt(profile: CoachProfile, slots: SlotWithCandidates[]): string {
  const lines = [
    `Student level (rating they solve comfortably): ${profile.level}. ${profile.levelReason}`,
    `Codeforces rating: ${profile.rating ?? "unrated"}. Problems solved: ${profile.totalSolved}.`,
    profile.weakTags.length ? `Struggling with: ${profile.weakTags.join(", ")}.` : null,
    profile.recentDays.length ? `Recent plans:\n${profile.recentDays.map((d) => `- ${d}`).join("\n")}` : "No earlier plans.",
    "",
    "Slots:",
    ...slots.flatMap((s, i) => [
      `${i}. ${SLOT_LABEL[s.slot]} (target ${s.target}${s.focusTag ? `, focus topic: ${s.focusTag}` : ""}${s.optional ? ", optional" : ""})`,
      ...s.candidates.map(
        (c) =>
          `   - ${c.externalId} "${c.name}" rating ${c.rating ?? "?"}, tags: ${c.tags.join(", ") || "none"}, solved by ${c.solvedCount}${c.note ? `, ${c.note}` : ""}`,
      ),
    ]),
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/**
 * Keep only valid AI picks (an ID from that slot's shortlist, not already used);
 * fill every other slot deterministically.
 */
export function reconcilePicks(
  slots: SlotWithCandidates[],
  aiPicks: { slot: number; problemId: string; reason: string }[],
  level: number,
): PlanPick[] {
  const used = new Set<string>();
  const chosen = new Map<number, PlanPick>();
  for (const p of aiPicks) {
    const slot = slots[p.slot];
    if (!slot || chosen.has(p.slot)) continue;
    const c = slot.candidates.find((c) => c.externalId === p.problemId);
    if (!c || used.has(c.externalId)) continue;
    used.add(c.externalId);
    const reason = p.reason.trim() || templateReason(slot, c, level);
    chosen.set(p.slot, { ...slot, choice: c, reason });
  }
  const out: PlanPick[] = [];
  slots.forEach((s, i) => {
    const pick =
      chosen.get(i) ?? pickDeterministically([{ ...s, candidates: s.candidates.filter((c) => !used.has(c.externalId)) }], level)[0];
    if (!pick) return;
    used.add(pick.choice.externalId);
    out.push(pick);
  });
  return out;
}

export async function coachPicks(
  profile: CoachProfile,
  slots: SlotWithCandidates[],
  choice: ModelChoice = defaultModel(),
): Promise<{ picks: PlanPick[]; theme: string; coachNote: string; model: string }> {
  const { output } = await generateText({
    model: choice.model,
    system: SYSTEM_PROMPT,
    prompt: buildCoachPrompt(profile, slots),
    output: Output.object({ schema: coachSchema }),
    temperature: 0.4,
    maxOutputTokens: 2000,
    abortSignal: AbortSignal.timeout(90_000),
  });
  return {
    picks: reconcilePicks(slots, output.picks, profile.level),
    theme: output.theme.trim(),
    coachNote: output.coachNote.trim(),
    model: choice.id,
  };
}
