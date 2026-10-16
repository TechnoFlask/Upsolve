// Shared by the DB schema, server code and client components.
export const PLATFORMS = ["codeforces", "leetcode", "atcoder", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const STATUSES = ["solved", "attempted", "upsolve", "revisit"] as const;
export type Status = (typeof STATUSES)[number];

// How you took part in a contest, strongest first: live (official or
// unofficial), as a virtual contest, or only by practising its problems.
export const PARTICIPATIONS = ["contest", "unofficial", "virtual", "practice"] as const;
export type Participation = (typeof PARTICIPATIONS)[number];

// Topic tags, in Codeforces' vocabulary, so problems from every judge share one set
// of topics (AtCoder and LeetCode problems get these from the solution analysis).
export const TOPIC_TAGS = [
  "2-sat", "binary search", "bitmasks", "brute force", "chinese remainder theorem", "combinatorics",
  "constructive algorithms", "data structures", "dfs and similar", "divide and conquer", "dp", "dsu",
  "expression parsing", "fft", "flows", "games", "geometry", "graph matchings", "graphs", "greedy",
  "hashing", "implementation", "interactive", "math", "matrices", "meet-in-the-middle", "number theory",
  "probabilities", "schedules", "shortest paths", "sortings", "string suffix structures", "strings",
  "ternary search", "trees", "two pointers",
] as const;
export type TopicTag = (typeof TOPIC_TAGS)[number];

// When a problem was first accepted: during a live or virtual participation, or afterwards.
export const SOLVED_DURING = ["contest", "virtual", "practice"] as const;
export type SolvedDuring = (typeof SOLVED_DURING)[number];
