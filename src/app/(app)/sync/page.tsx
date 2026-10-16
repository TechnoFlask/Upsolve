import { Suspense } from "react";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { JudgeSync } from "./judge-sync";

export default function SyncPage() {
  return (
    <main className="max-w-2xl pb-16">
      <h1 className="pt-8 font-display text-4xl font-semibold tracking-tight">Sync</h1>
      <p className="mt-1 text-pencil">
        Pull your submissions straight from the judges. Your notes, editorial flags and any status
        you set yourself are kept.
      </p>
      <Suspense fallback={<div className="mt-8 h-40 rounded-lg border border-rule bg-sheet" />}>
        <Accounts />
      </Suspense>
      <p className="mt-6 text-meta text-pencil">LeetCode sync comes next.</p>
    </main>
  );
}

async function Accounts() {
  await requireSession();
  const rows = await db.select().from(accounts);
  const account = (platform: string) => rows.find((a) => a.platform === platform);
  const cf = account("codeforces");
  const ac = account("atcoder");
  return (
    <div className="mt-8 flex flex-col gap-5">
      <JudgeSync
        judge="codeforces"
        handle={cf?.handle ?? ""}
        lastSyncedAt={cf?.lastSyncedAt ?? null}
        note="Every submission, with ratings and tags, plus your rated, unofficial and virtual contests."
      />
      <JudgeSync
        judge="atcoder"
        handle={ac?.handle ?? ""}
        lastSyncedAt={ac?.lastSyncedAt ?? null}
        note="Every submission with AtCoder Problems' difficulty estimates, plus your contest history. AtCoder has no tags, and virtual participations aren't visible to the app."
      />
    </div>
  );
}
