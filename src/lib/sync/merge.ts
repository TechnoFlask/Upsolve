import type { Participation, SolvedDuring, Status } from "../constants";

// What every judge's sync produces, and how it merges into what you already track.

export type SyncedProblem = {
  externalId: string;
  name: string;
  url: string;
  difficulty: number | null;
  tags: string[];
  status: Extract<Status, "solved" | "attempted">;
  tries: number;
  solvedAt: Date | null;
  solvedDuring: SolvedDuring | null;
  /** Latest accepted submission: the code you'd want analysed. */
  submissionId: number | null;
  submissionLanguage: string | null;
};

export type SyncedContestProblem = {
  index: string;
  externalId: string;
  name: string;
  url: string;
  difficulty: number | null;
  tags: string[];
};

export type SyncedContest = {
  externalId: string;
  name: string;
  url: string;
  date: Date | null;
  participation: Participation;
  rank: number | null;
  oldRating: number | null;
  newRating: number | null;
  problems: SyncedContestProblem[];
};

/** Lower is a stronger form of taking part; a contest keeps the strongest one seen. */
export const PARTICIPATION_RANK: Record<Participation, number> = {
  contest: 0,
  unofficial: 1,
  virtual: 2,
  practice: 3,
};

type ExistingRow = {
  name: string;
  url: string | null;
  difficulty: number | null;
  tags: string[];
  status: Status;
  tries: number;
  solvedAt: Date | null;
  solvedDuring: SolvedDuring | null;
  submissionId: number | null;
  submissionLanguage: string | null;
};

export type MergedFields = ExistingRow;

/**
 * Combine judge facts with what's already tracked. The judge owns name, link,
 * rating, tries and solve date; you own notes, the editorial flag and any
 * status you set yourself, except that solving an "attempted" or "upsolve"
 * problem marks it solved.
 */
export function mergeWithExisting(incoming: SyncedProblem, existing: ExistingRow | undefined): MergedFields {
  if (!existing) {
    return {
      name: incoming.name,
      url: incoming.url,
      difficulty: incoming.difficulty,
      tags: incoming.tags,
      status: incoming.status,
      tries: incoming.tries,
      solvedAt: incoming.solvedAt,
      solvedDuring: incoming.solvedDuring,
      submissionId: incoming.submissionId,
      submissionLanguage: incoming.submissionLanguage,
    };
  }
  const promote = incoming.status === "solved" && (existing.status === "attempted" || existing.status === "upsolve");
  return {
    name: incoming.name,
    url: incoming.url,
    difficulty: incoming.difficulty ?? existing.difficulty,
    tags: [...new Set([...existing.tags, ...incoming.tags])],
    status: promote ? "solved" : existing.status,
    tries: incoming.tries,
    solvedAt: incoming.solvedAt ?? existing.solvedAt,
    solvedDuring: incoming.solvedDuring ?? existing.solvedDuring,
    submissionId: incoming.submissionId ?? existing.submissionId,
    submissionLanguage: incoming.submissionId ? incoming.submissionLanguage : existing.submissionLanguage,
  };
}

export function hasChanges(existing: ExistingRow, merged: MergedFields): boolean {
  return (
    existing.name !== merged.name ||
    existing.url !== merged.url ||
    existing.difficulty !== merged.difficulty ||
    existing.status !== merged.status ||
    existing.tries !== merged.tries ||
    existing.solvedDuring !== merged.solvedDuring ||
    existing.submissionId !== merged.submissionId ||
    existing.submissionLanguage !== merged.submissionLanguage ||
    existing.solvedAt?.getTime() !== merged.solvedAt?.getTime() ||
    sameTags(existing.tags, merged.tags) === false
  );
}

export function sameTags(a: string[], b: string[]): boolean {
  return a.join("\u0000") === b.join("\u0000");
}
