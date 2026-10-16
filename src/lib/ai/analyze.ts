import "server-only";
import { generateText, Output } from "ai";
import type { Problem } from "@/db/schema";
import { TOPIC_TAGS } from "@/lib/constants";
import { solutionAnalysisSchema, type SolutionAnalysis } from "@/lib/analysis-schema";
import { PLATFORM_NAMES } from "@/lib/difficulty";
import { defaultModel, type ModelChoice } from "./model";

const SYSTEM_PROMPT = `You are a competitive-programming coach reviewing a student's accepted solution.

Describe THEIR solution as written. Do not swap in a different algorithm.

Fields:
- approach: 1–3 sentences on the core idea of their solution.
- pseudocode: concise, language-neutral pseudocode that mirrors their code's structure (loops, data structures, key steps). Plain indentation, no markdown fences.
- time, space: their solution's complexity in Big-O, using the problem's variables (e.g. "O(n log n)", "O(n + m)"). Space excludes the input unless they copy it.
- complexityReasoning: one or two sentences explaining where the time and space come from.
- isOptimal: true if no asymptotically better solution is known for this problem's constraints.
- optimalTime, optimalSpace: the best known complexity when isOptimal is false, otherwise null.
- hints: when isOptimal is false, 2–4 hints that go from a gentle nudge to more specific, never giving the full solution or code. When isOptimal is true, an empty array.
- assumptions: if you're unsure of the exact statement or constraints, say what you assumed; otherwise null.
- suggestedTags: 1–4 topic tags naming the techniques THEIR solution relies on, most important first, chosen only from this list: ${TOPIC_TAGS.join(", ")}. Use "implementation" only when nothing more specific applies.`;

type ProblemInfo = Pick<Problem, "platform" | "externalId" | "name" | "difficulty" | "tags" | "url">;

export function buildUserMessage(problem: ProblemInfo, code: string, language: string | null): string {
  const lines = [
    `Problem: ${PLATFORM_NAMES[problem.platform]} ${problem.externalId}, "${problem.name}"`,
    problem.difficulty != null ? `Difficulty: ${problem.difficulty}` : null,
    problem.tags.length ? `Tags: ${problem.tags.join(", ")}` : null,
    problem.url ? `Link: ${problem.url}` : null,
    language ? `Language: ${language}` : null,
    "",
    "Accepted solution:",
    "```",
    code,
    "```",
  ];
  return lines.filter((l) => l !== null).join("\n");
}

const TOPICS = new Set<string>(TOPIC_TAGS);

/** Keep the optimal fields consistent with the verdict, and tags to known topics. */
export function normalizeAnalysis(a: SolutionAnalysis): SolutionAnalysis {
  const suggestedTags = [...new Set((a.suggestedTags ?? []).map((t) => t.trim().toLowerCase()))]
    .filter((t) => TOPICS.has(t))
    .slice(0, 4);
  const withTags = { ...a, suggestedTags };
  return a.isOptimal ? { ...withTags, optimalTime: null, optimalSpace: null, hints: [] } : withTags;
}

export async function analyzeSolution(
  problem: ProblemInfo,
  code: string,
  language: string | null,
  choice: ModelChoice = defaultModel(),
): Promise<{ analysis: SolutionAnalysis; model: string }> {
  const { output } = await generateText({
    model: choice.model,
    system: SYSTEM_PROMPT,
    prompt: buildUserMessage(problem, code, language),
    output: Output.object({ schema: solutionAnalysisSchema }),
    temperature: 0.2,
    maxOutputTokens: 2500,
    abortSignal: AbortSignal.timeout(90_000),
  });
  return { analysis: normalizeAnalysis(output), model: choice.id };
}
