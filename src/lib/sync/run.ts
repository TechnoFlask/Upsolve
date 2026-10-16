import "server-only";
import type { BatchItem } from "drizzle-orm/batch";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, contestProblems, contests, problems, problemset } from "@/db/schema";
import * as atcoder from "./atcoder";
import { buildCatalog, catalogEntryChanged, fetchAll, type CatalogEntry, summarizeContests, summarizeSubmissions } from "./codeforces";
import { hasChanges, mergeWithExisting, sameTags, type SyncedContest, type SyncedProblem } from "./merge";

type SyncedPlatform = "codeforces" | "atcoder";

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

async function refreshCatalog(entries: CatalogEntry[]) {
  const existing = new Map(
    (
      await db
        .select({
          externalId: problemset.externalId,
          name: problemset.name,
          rating: problemset.rating,
          tags: problemset.tags,
          solvedCount: problemset.solvedCount,
        })
        .from(problemset)
        .where(eq(problemset.platform, "codeforces"))
    ).map((r) => [r.externalId, r]),
  );
  const writes: BatchItem<"sqlite">[] = [];
  for (const e of entries) {
    const row = existing.get(e.externalId);
    if (!row || catalogEntryChanged(row, e)) {
      writes.push(
        db
          .insert(problemset)
          .values({ platform: "codeforces", ...e })
          .onConflictDoUpdate({
            target: [problemset.platform, problemset.externalId],
            set: { name: e.name, rating: e.rating, tags: e.tags, solvedCount: e.solvedCount },
          }),
      );
    }
  }
  await runInBatches(writes);
}

export async function syncCodeforces(handle: string): Promise<SyncResult> {
  const data = await fetchAll(handle);
  await refreshCatalog(buildCatalog(data.problemset, data.problemStatistics));
  return saveSync("codeforces", handle, summarizeSubmissions(data.submissions), summarizeContests(data));
}

export async function syncAtCoder(handle: string): Promise<SyncResult> {
  const data = await atcoder.fetchAll(handle);
  // AtCoder can't tell an unknown user from one who hasn't started, so don't save a typo.
  if (data.submissions.length === 0 && data.history.length === 0) {
    throw new Error(`Found no submissions or contests for ${handle} on AtCoder. Check the spelling; handles are case-sensitive.`);
  }
  return saveSync("atcoder", handle, atcoder.summarizeSubmissions(data), atcoder.summarizeContests(data));
}

/**
 * Write one judge's problems, contests and contest problem sets, then stamp the
 * account. Only rows that actually changed are written.
 */
async function saveSync(
  platform: SyncedPlatform,
  handle: string,
  synced: SyncedProblem[],
  syncedContests: SyncedContest[],
): Promise<SyncResult> {
  // --- problems you submitted to
  const existingProblems = new Map(
    (await db.select().from(problems).where(eq(problems.platform, platform))).map((r) => [r.externalId, r]),
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
        db.insert(problems).values({ platform, externalId: incoming.externalId, source: "sync", ...merged }),
      );
    } else if (hasChanges(row, merged)) {
      updated++;
      writes.push(
        db
          .update(problems)
          .set(merged)
          .where(and(eq(problems.platform, platform), eq(problems.externalId, incoming.externalId))),
      );
    }
  }

  // --- contests (your notes on a contest are never touched)
  const existingContests = new Map(
    (await db.select().from(contests).where(eq(contests.platform, platform))).map((c) => [c.externalId, c]),
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
      writes.push(db.insert(contests).values({ platform, ...fields }));
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
    (await db.select({ id: contests.id, externalId: contests.externalId }).from(contests).where(eq(contests.platform, platform))).map(
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
      .values({ platform, handle, lastSyncedAt: now })
      .onConflictDoUpdate({ target: accounts.platform, set: { handle, lastSyncedAt: now } }),
  );
  await runInBatches(cpWrites);

  return { added, updated, total: synced.length, contests: syncedContests.length };
}
