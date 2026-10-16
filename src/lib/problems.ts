import "server-only";
import { and, asc, desc, eq, gte, inArray, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { PLATFORMS, STATUSES, problems } from "@/db/schema";
import { endOfDayExclusive, startOfDay } from "@/lib/dates";

const csv = <T extends z.ZodType<unknown, string>>(item: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(item));

const optionalInt = z.coerce.number().int().optional().catch(undefined);
const optionalDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const SORT_FIELDS = ["solvedAt", "difficulty", "name", "tries", "updatedAt"] as const;

// Parsed from URL search params so filters are shareable and survive reloads.
export const problemFiltersSchema = z.object({
  q: z.string().trim().optional(),
  platform: csv(z.enum(PLATFORMS)).catch([]),
  status: csv(z.enum(STATUSES)).catch([]),
  tag: csv(z.string()).catch([]),
  minDifficulty: optionalInt,
  maxDifficulty: optionalInt,
  from: optionalDay,
  to: optionalDay,
  editorial: z.enum(["yes", "no"]).optional().catch(undefined),
  sort: z.enum(SORT_FIELDS).catch("solvedAt").default("solvedAt"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
});
export type ProblemFilters = z.infer<typeof problemFiltersSchema>;

export function parseProblemFilters(params: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]),
  );
  return problemFiltersSchema.parse(flat);
}

export async function listProblems(f: ProblemFilters) {
  const where: SQL[] = [];
  if (f.q) {
    const pattern = `%${f.q}%`;
    where.push(
      or(
        like(problems.name, pattern),
        like(problems.externalId, pattern),
        like(problems.notes, pattern),
      )!,
    );
  }
  if (f.platform.length) where.push(inArray(problems.platform, f.platform));
  if (f.status.length) where.push(inArray(problems.status, f.status));
  for (const tag of f.tag) {
    where.push(sql`exists (select 1 from json_each(${problems.tags}) where value = ${tag})`);
  }
  if (f.minDifficulty !== undefined) where.push(gte(problems.difficulty, f.minDifficulty));
  if (f.maxDifficulty !== undefined) where.push(lte(problems.difficulty, f.maxDifficulty));
  // Whole days in the display timezone; "to" includes the day itself.
  if (f.from) where.push(gte(problems.solvedAt, startOfDay(f.from)));
  if (f.to) where.push(lt(problems.solvedAt, endOfDayExclusive(f.to)));
  if (f.editorial) where.push(eq(problems.usedEditorial, f.editorial === "yes"));

  const order = f.dir === "asc" ? asc : desc;
  return db
    .select()
    .from(problems)
    .where(where.length ? and(...where) : undefined)
    .orderBy(order(problems[f.sort]), desc(problems.id));
}

export async function problemCounts() {
  const rows = await db
    .select({ status: problems.status, n: sql<number>`count(*)` })
    .from(problems)
    .groupBy(problems.status);
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return {
    total: rows.reduce((sum, r) => sum + r.n, 0),
    upsolve: byStatus.upsolve ?? 0,
    revisit: byStatus.revisit ?? 0,
  };
}

export async function getProblem(id: number) {
  return db.query.problems.findFirst({ where: eq(problems.id, id) });
}

export async function listAllTags(): Promise<string[]> {
  const rows = await db.all<{ value: string }>(
    sql`select distinct j.value as value from ${problems}, json_each(${problems.tags}) j order by value`,
  );
  return rows.map((r) => r.value);
}
