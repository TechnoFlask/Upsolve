"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { PLATFORMS, STATUSES, problems } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { middayOf } from "@/lib/dates";

const emptyToNull = (v: unknown) => (v === "" ? null : v);

const problemInputSchema = z.object({
  platform: z.enum(PLATFORMS),
  externalId: z.string().trim().min(1, "Problem ID is required"),
  name: z.string().trim().min(1, "Name is required"),
  url: z.preprocess(emptyToNull, z.url("Enter a full link, starting with https://").nullish()),
  difficulty: z.preprocess(emptyToNull, z.coerce.number().int().nullish()),
  difficultyLabel: z.preprocess(emptyToNull, z.string().trim().nullish()),
  tags: z
    .string()
    .default("")
    .transform((s) => [...new Set(s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))]),
  status: z.enum(STATUSES),
  tries: z.coerce.number().int().min(0).default(1),
  usedEditorial: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  solvedAt: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
      .transform(middayOf)
      .nullish(),
  ),
  notes: z.preprocess(emptyToNull, z.string().nullish()),
});

export type ProblemFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof problemInputSchema>, string[]>>;
};

function parse(formData: FormData) {
  return problemInputSchema.safeParse(Object.fromEntries(formData));
}

function isUniqueViolation(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.message} ${String(e.cause ?? "")}` : String(e);
  return msg.includes("UNIQUE constraint failed");
}

export async function createProblem(
  _prev: ProblemFormState,
  formData: FormData,
): Promise<ProblemFormState> {
  await requireSession();
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  try {
    await db.insert(problems).values({ ...parsed.data, source: "manual" });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "That problem is already tracked." };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProblem(
  id: number,
  _prev: ProblemFormState,
  formData: FormData,
): Promise<ProblemFormState> {
  await requireSession();
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  try {
    await db.update(problems).set(parsed.data).where(eq(problems.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Another tracked problem already has that ID." };
    throw e;
  }
  // Layout-wide: the problem may be shown on contest pages too.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteProblem(id: number): Promise<void> {
  await requireSession();
  await db.delete(problems).where(eq(problems.id, id));
  revalidatePath("/", "layout");
}
