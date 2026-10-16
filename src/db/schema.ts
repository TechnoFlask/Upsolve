import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
// Relative import: drizzle-kit loads this file without the "@/" path alias.
import type { SolutionAnalysis } from "../lib/analysis-schema";
import { PARTICIPATIONS, PLATFORMS, SOLVED_DURING, STATUSES } from "../lib/constants";

export { PLATFORMS, STATUSES };
export type { Platform, Status } from "../lib/constants";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

export const contests = sqliteTable(
  "contests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    url: text("url"),
    date: integer("date", { mode: "timestamp" }),
    rank: integer("rank"),
    oldRating: integer("old_rating"),
    newRating: integer("new_rating"),
    participation: text("participation", { enum: PARTICIPATIONS }).notNull().default("practice"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("contests_platform_ext_idx").on(t.platform, t.externalId)],
);

// Every problem in a contest, including ones you never opened, so the
// contest view can show what is left to upsolve. Joined to `problems` on
// (platform, externalId) for your status.
export const contestProblems = sqliteTable(
  "contest_problems",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contestId: integer("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    index: text("index").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    url: text("url"),
    difficulty: integer("difficulty"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("contest_problems_contest_index_idx").on(t.contestId, t.index),
    index("contest_problems_ext_idx").on(t.externalId),
  ],
);

export const problems = sqliteTable(
  "problems",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    url: text("url"),
    // Numeric for sorting: CF rating, AtCoder difficulty, LC Easy=1/Medium=2/Hard=3.
    difficulty: integer("difficulty"),
    difficultyLabel: text("difficulty_label"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    status: text("status", { enum: STATUSES }).notNull().default("solved"),
    tries: integer("tries").notNull().default(1),
    usedEditorial: integer("used_editorial", { mode: "boolean" })
      .notNull()
      .default(false),
    solvedAt: integer("solved_at", { mode: "timestamp" }),
    notes: text("notes"),
    solvedDuring: text("solved_during", { enum: SOLVED_DURING }),
    // Your latest accepted submission on the judge (from sync).
    submissionId: integer("submission_id"),
    submissionLanguage: text("submission_language"),
    // Code you pasted in for analysis, and the model's analysis of it.
    solutionCode: text("solution_code"),
    analysis: text("analysis", { mode: "json" }).$type<SolutionAnalysis>(),
    analysisModel: text("analysis_model"),
    analyzedAt: integer("analyzed_at", { mode: "timestamp" }),
    source: text("source", { enum: ["manual", "sync"] })
      .notNull()
      .default("manual"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("problems_platform_ext_idx").on(t.platform, t.externalId),
    index("problems_status_idx").on(t.status),
    index("problems_solved_at_idx").on(t.solvedAt),
  ],
);

// The judge's whole problem catalogue, refreshed on sync. The daily planner
// picks suggestions from here; solvedCount is a rough quality/popularity signal.
export const problemset = sqliteTable(
  "problemset",
  {
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    externalId: text("external_id").notNull(),
    contestId: integer("contest_id").notNull(),
    index: text("index").notNull(),
    name: text("name").notNull(),
    rating: integer("rating"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    solvedCount: integer("solved_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.platform, t.externalId] }),
    index("problemset_rating_idx").on(t.platform, t.rating),
  ],
);

export const PRACTICE_SLOTS = ["warmup", "core", "weak", "stretch", "upsolve"] as const;
export type PracticeSlot = (typeof PRACTICE_SLOTS)[number];

/** One day's practice plan. `level` is the rating the plan was built around. */
export const practicePlans = sqliteTable("practice_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: text("day").notNull().unique(),
  level: integer("level").notNull(),
  size: integer("size").notNull(),
  theme: text("theme"),
  coachNote: text("coach_note"),
  model: text("model"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const practiceItems = sqliteTable(
  "practice_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id")
      .notNull()
      .references(() => practicePlans.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    slot: text("slot", { enum: PRACTICE_SLOTS }).notNull(),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    url: text("url"),
    difficulty: integer("difficulty"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    reason: text("reason").notNull(),
    focusTag: text("focus_tag"),
  },
  (t) => [
    uniqueIndex("practice_items_plan_problem_idx").on(t.planId, t.externalId),
    index("practice_items_ext_idx").on(t.platform, t.externalId),
  ],
);

export const accounts = sqliteTable("accounts", {
  platform: text("platform", { enum: PLATFORMS }).primaryKey(),
  handle: text("handle").notNull(),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
});

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ip: text("ip").notNull(),
    at: integer("at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("login_attempts_ip_at_idx").on(t.ip, t.at)],
);

export type Problem = typeof problems.$inferSelect;
export type NewProblem = typeof problems.$inferInsert;
export type Contest = typeof contests.$inferSelect;
export type ContestProblem = typeof contestProblems.$inferSelect;
export type PracticePlan = typeof practicePlans.$inferSelect;
export type PracticeItem = typeof practiceItems.$inferSelect;
export type CatalogProblem = typeof problemset.$inferSelect;
