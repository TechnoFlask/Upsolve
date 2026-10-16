// Shared by the DB schema, server code and client components.
export const PLATFORMS = ["codeforces", "leetcode", "atcoder", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const STATUSES = ["solved", "attempted", "upsolve", "revisit"] as const;
export type Status = (typeof STATUSES)[number];

// How you took part in a contest, strongest first: live (official or
// unofficial), as a virtual contest, or only by practising its problems.
export const PARTICIPATIONS = ["contest", "unofficial", "virtual", "practice"] as const;
export type Participation = (typeof PARTICIPATIONS)[number];

// When a problem was first accepted: during a live or virtual participation, or afterwards.
export const SOLVED_DURING = ["contest", "virtual", "practice"] as const;
export type SolvedDuring = (typeof SOLVED_DURING)[number];
