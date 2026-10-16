"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { PLAN_SIZES, type PlanSize } from "@/lib/practice/planner";
import { generatePlan, swapItem, syncProgress } from "@/lib/practice/service";

export type TodayActionResult = { ok: true; notice?: string } | { ok: false; error: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function planTodayAction(size: number): Promise<TodayActionResult> {
  await requireSession();
  if (!(size in PLAN_SIZES)) return { ok: false, error: "Pick a plan size." };
  try {
    const { aiError } = await generatePlan(size as PlanSize);
    revalidatePath("/", "layout");
    return aiError
      ? { ok: true, notice: `The AI coach wasn't available (${aiError}), so these were picked by rules instead.` }
      : { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function swapItemAction(itemId: number): Promise<TodayActionResult> {
  await requireSession();
  try {
    await swapItem(itemId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function syncProgressAction(): Promise<TodayActionResult> {
  await requireSession();
  try {
    await syncProgress();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
