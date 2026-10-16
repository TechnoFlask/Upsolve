"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { problems } from "@/db/schema";
import { analyzeSolution } from "@/lib/ai/analyze";
import { describeAiError } from "@/lib/ai/model";
import type { SolutionAnalysis } from "@/lib/analysis-schema";
import { requireSession } from "@/lib/auth";
import { TOPIC_TAGS } from "@/lib/constants";

const MAX_CODE_CHARS = 64_000;

export type AnalyzeResult =
  | { ok: true; analysis: SolutionAnalysis; model: string; analyzedAt: Date }
  | { ok: false; error: string };

export async function analyzeSolutionAction(problemId: number, code: string): Promise<AnalyzeResult> {
  await requireSession();
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: "Paste your solution's code first." };
  if (trimmed.length > MAX_CODE_CHARS) return { ok: false, error: "That code is too long to analyze (64,000 characters max)." };

  const problem = await db.query.problems.findFirst({ where: eq(problems.id, problemId) });
  if (!problem) return { ok: false, error: "This problem no longer exists." };

  // Keep the code even if the analysis fails, so it isn't lost.
  await db.update(problems).set({ solutionCode: trimmed }).where(eq(problems.id, problemId));

  try {
    const { analysis, model } = await analyzeSolution(problem, trimmed, problem.submissionLanguage);
    const analyzedAt = new Date();
    await db
      .update(problems)
      .set({ analysis, analysisModel: model, analyzedAt })
      .where(eq(problems.id, problemId));
    revalidatePath("/", "layout");
    return { ok: true, analysis, model, analyzedAt };
  } catch (e) {
    return { ok: false, error: describeAiError(e) };
  }
}

export type AddTagsResult = { ok: true; tags: string[] } | { ok: false; error: string };

const tagsSchema = z.array(z.enum(TOPIC_TAGS)).min(1).max(8);

/** Accept suggested topic tags: add them to the problem's tags, keeping the ones it has. */
export async function addTagsAction(problemId: number, tags: string[]): Promise<AddTagsResult> {
  await requireSession();
  const parsed = tagsSchema.safeParse(tags);
  if (!parsed.success) return { ok: false, error: "Those aren't topic tags this app knows." };

  const problem = await db.query.problems.findFirst({ where: eq(problems.id, problemId) });
  if (!problem) return { ok: false, error: "This problem no longer exists." };

  const merged = [...new Set([...problem.tags, ...parsed.data])];
  await db.update(problems).set({ tags: merged }).where(eq(problems.id, problemId));
  revalidatePath("/", "layout");
  return { ok: true, tags: merged };
}
