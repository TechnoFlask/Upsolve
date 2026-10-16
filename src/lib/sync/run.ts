import "server-only";
import type { BatchItem } from "drizzle-orm/batch";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, contestProblems, contests, problems } from "@/db/schema";
import {
  fetchAll,
  hasChanges,
  mergeWithExisting,
  sameTags,
  summarizeContests,
  summarizeSubmissions,
} from "./codeforces";

export type SyncResult = {
  added: number;
  updated: number;
  total: number;
  contests: number;
};

// Turso caps statements per request; keep each batch well under it.
const BATCH_SIZE = 400;

async function runInBatches(statements: BatchItem<"sqlite">[]) {
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const chunk = statements.slice(i, i + BATCH_SIZE);
    await db.batch(chunk as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
}

export async function syncCodeforces(handle: string): Promise<SyncResult> {
  const data = await fetchAll(handle);
  const synced = summarizeSubmissions(data.submissions);
  const syncedContests = summarizeContests(data);

  // --- problems you submitted to
  const existingProblems = new Map(
    (await db.select().from(problems).where(eq(problems.platform, "codeforces"))).map((r) => [r.externalId, r]),
  );
  const writes: BatchItem<"sqlite">[] = [];
  let added = 0;
  let updated = 0;
  for (const incoming of synced) {
    const row = existingProblems.get(incoming.externalId);
    const merged = mergeWithExisting(incoming, row);
    if (!row) {
      added++;
      writes.push(
        db.insert(problems).values({ platform: "codeforces", externalId: incoming.externalId, source: "sync", ...merged }),
      );
    } else if (hasChanges(row, merged)) {
      updated++;
      writes.push(
        db
          .update(problems)
          .set(merged)
          .where(and(eq(problems.platform, "codeforces"), eq(problems.externalId, incoming.externalId))),
      );
    }
  }

  // --- contests (your notes on a contest are never touched)
  const existingContests = new Map(
    (await db.select().from(contests).where(eq(contests.platform, "codeforces"))).map((c) => [c.externalId, c]),
  );
  for (const c of syncedContests) {
    const fields = {
      externalId: c.externalId,
      name: c.name,
      url: c.url,
      date: c.date,
      participation: c.participation,
      rank: c.rank,
      oldRating: c.oldRating,
      newRating: c.newRating,
    };
    const row = existingContests.get(c.externalId);
    if (!row) {
      writes.push(db.insert(contests).values({ platform: "codeforces", ...fields }));
    } else if (
      row.name !== fields.name ||
      row.date?.getTime() !== fields.date?.getTime() ||
      row.participation !== fields.participation ||
      row.rank !== fields.rank ||
      row.oldRating !== fields.oldRating ||
      row.newRating !== fields.newRating
    ) {
      writes.push(db.update(contests).set(fields).where(eq(contests.id, row.id)));
    }
  }
  await runInBatches(writes);

  // --- each contest's full problem set (needs contest row ids from above)
  const contestIds = new Map(
    (await db.select({ id: contests.id, externalId: contests.externalId }).from(contests).where(eq(contests.platform, "codeforces"))).map(
      (c) => [c.externalId, c.id],
    ),
  );
  const existingCp = new Map(
    (await db.select().from(contestProblems)).map((p) => [`${p.contestId}:${p.index}`, p]),
  );
  const cpWrites: BatchItem<"sqlite">[] = [];
  for (const c of syncedContests) {
    const contestId = contestIds.get(c.externalId)!;
    for (const p of c.problems) {
      const row = existingCp.get(`${contestId}:${p.index}`);
      if (!row) {
        cpWrites.push(db.insert(contestProblems).values({ contestId, ...p }));
      } else if (row.name !== p.name || row.difficulty !== p.difficulty || row.url !== p.url || !sameTags(row.tags, p.tags)) {
        cpWrites.push(db.update(contestProblems).set(p).where(eq(contestProblems.id, row.id)));
      }
    }
  }

  // Stamp last so a sync that dies part-way shows as not finished; re-running is safe.
  const now = new Date();
  cpWrites.push(
    db
      .insert(accounts)
      .values({ platform: "codeforces", handle, lastSyncedAt: now })
      .onConflictDoUpdate({ target: accounts.platform, set: { handle, lastSyncedAt: now } }),
  );
  await runInBatches(cpWrites);

  return { added, updated, total: synced.length, contests: syncedContests.length };
}
