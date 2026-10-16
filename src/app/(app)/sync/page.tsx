import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { CodeforcesSync } from "./codeforces-sync";

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
      <p className="mt-6 text-meta text-pencil">LeetCode and AtCoder sync come next.</p>
    </main>
  );
}

async function Accounts() {
  await requireSession();
  const cf = await db.query.accounts.findFirst({ where: eq(accounts.platform, "codeforces") });
  return (
    <CodeforcesSync
      handle={cf?.handle ?? ""}
      lastSyncedAt={cf?.lastSyncedAt ?? null}
    />
  );
}
