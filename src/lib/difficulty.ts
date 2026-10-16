import type { Platform, Status } from "@/lib/constants";

// Rating-tier ink, after each platform's own colour scheme. Hues are darkened
// where the original fails contrast on white (CF orange, AtCoder yellow/cyan).
type Tier = { below: number; color: string; name: string };

const CODEFORCES: Tier[] = [
  { below: 1200, color: "#6b7280", name: "Newbie" },
  { below: 1400, color: "#0a7d2c", name: "Pupil" },
  { below: 1600, color: "#00897b", name: "Specialist" },
  { below: 1900, color: "#1a3fd6", name: "Expert" },
  { below: 2100, color: "#9a1ba6", name: "Candidate master" },
  { below: 2400, color: "#c46a00", name: "Master" },
  { below: Infinity, color: "#d11a1a", name: "Grandmaster" },
];

const ATCODER: Tier[] = [
  { below: 400, color: "#6b7280", name: "Gray" },
  { below: 800, color: "#804000", name: "Brown" },
  { below: 1200, color: "#0a7d2c", name: "Green" },
  { below: 1600, color: "#00838f", name: "Cyan" },
  { below: 2000, color: "#1a3fd6", name: "Blue" },
  { below: 2400, color: "#8a7400", name: "Yellow" },
  { below: 2800, color: "#c46a00", name: "Orange" },
  { below: Infinity, color: "#d11a1a", name: "Red" },
];

export const LEETCODE_LEVELS = [
  { value: 1, label: "Easy", color: "#00796b" },
  { value: 2, label: "Medium", color: "#a86b00" },
  { value: 3, label: "Hard", color: "#c62828" },
] as const;

const INK = "#1b2430";

export function tierColor(platform: Platform, difficulty: number | null): string {
  if (difficulty == null) return INK;
  if (platform === "leetcode") {
    return LEETCODE_LEVELS.find((l) => l.value === difficulty)?.color ?? INK;
  }
  const tiers = platform === "codeforces" ? CODEFORCES : platform === "atcoder" ? ATCODER : null;
  return tiers?.find((t) => difficulty < t.below)?.color ?? INK;
}

export function difficultyText(
  platform: Platform,
  difficulty: number | null,
  label: string | null,
): string {
  if (label) return label;
  if (difficulty == null) return "";
  if (platform === "leetcode") {
    return LEETCODE_LEVELS.find((l) => l.value === difficulty)?.label ?? String(difficulty);
  }
  return String(difficulty);
}

export const PLATFORM_NAMES: Record<Platform, string> = {
  codeforces: "Codeforces",
  leetcode: "LeetCode",
  atcoder: "AtCoder",
  other: "Other",
};

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  solved: { label: "Solved", color: "var(--color-accepted)" },
  attempted: { label: "Attempted", color: "var(--color-wrong)" },
  upsolve: { label: "Upsolve", color: "var(--color-amber)" },
  revisit: { label: "Revisit", color: "var(--color-revisit)" },
};
