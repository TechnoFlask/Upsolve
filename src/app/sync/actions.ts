"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { syncAtCoder, syncCodeforces, type SyncResult } from "@/lib/sync/run";

export type SyncState = { ok?: string; error?: string };

const JUDGES = {
  codeforces: {
    name: "Codeforces",
    handle: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_.-]{3,24}$/, "Codeforces handles are 3–24 letters, digits, _ . or -."),
    sync: syncCodeforces,
  },
  atcoder: {
    name: "AtCoder",
    handle: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{3,16}$/, "AtCoder usernames are 3–16 letters, digits or _."),
    sync: syncAtCoder,
  },
} satisfies Record<string, { name: string; handle: z.ZodType<string>; sync: (handle: string) => Promise<SyncResult> }>;

async function runSync(judge: keyof typeof JUDGES, formData: FormData): Promise<SyncState> {
  await requireSession();
  const { name, handle: handleSchema, sync } = JUDGES[judge];
  const parsed = handleSchema.safeParse(formData.get("handle"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const handle = parsed.data;

  try {
    const { added, updated, total, contests } = await sync(handle);
    revalidatePath("/", "layout");
    if (total === 0 && contests === 0) return { ok: `No submissions found for ${handle} yet.` };
    const changes =
      added || updated
        ? `Added ${added} new and updated ${updated} existing problems.`
        : "Your problems were already up to date.";
    return {
      ok: `Synced ${total} problems and ${contests} ${contests === 1 ? "contest" : "contests"} from ${handle}. ${changes}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (judge === "codeforces" && message.includes("not found")) {
      return { error: `Codeforces has no user called ${handle}. Check the spelling.` };
    }
    if (e instanceof Error && e.name === "TimeoutError") return { error: `${name} didn't respond in time. Try again shortly.` };
    return { error: message };
  }
}

export async function syncCodeforcesAction(_prev: SyncState, formData: FormData): Promise<SyncState> {
  return runSync("codeforces", formData);
}

export async function syncAtCoderAction(_prev: SyncState, formData: FormData): Promise<SyncState> {
  return runSync("atcoder", formData);
}
