"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contestProblems, contests, problems } from "@/db/schema";
import { requireSession } from "@/lib/auth";

/** Put a contest problem in your upsolve queue (tracking it if it isn't yet). */
export async function addToUpsolve(contestProblemId: number): Promise<void> {
  await requireSession();
  const [row] = await db
    .select({ cp: contestProblems, platform: contests.platform })
    .from(contestProblems)
    .innerJoin(contests, eq(contests.id, contestProblems.contestId))
    .where(eq(contestProblems.id, contestProblemId));
  if (!row) return;

  const { cp, platform } = row;
  const existing = await db.query.problems.findFirst({
    where: and(eq(problems.platform, platform), eq(problems.externalId, cp.externalId)),
  });

  if (!existing) {
    await db.insert(problems).values({
      platform,
      externalId: cp.externalId,
      name: cp.name,
      url: cp.url,
      difficulty: cp.difficulty,
      tags: cp.tags,
      status: "upsolve",
      tries: 0,
      source: "sync",
    });
  } else if (existing.status !== "solved" && !existing.solvedAt) {
    await db.update(problems).set({ status: "upsolve" }).where(eq(problems.id, existing.id));
  }

  revalidatePath("/", "layout");
}
