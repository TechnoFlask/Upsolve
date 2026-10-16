import type { Platform } from "./constants";

type SubmittedProblem = {
  platform: Platform;
  externalId: string;
  url: string | null;
  submissionId: number | null;
};

/** Link to one of your submissions on the judge, where you can copy its code. */
export function submissionUrl(p: SubmittedProblem): string | null {
  if (!p.submissionId) return null;
  if (p.platform === "codeforces") {
    const contestId = /^(\d+)/.exec(p.externalId)?.[1];
    if (!contestId) return null;
    const section = Number(contestId) >= 100000 ? "gym" : "contest";
    return `https://codeforces.com/${section}/${contestId}/submission/${p.submissionId}`;
  }
  if (p.platform === "atcoder") {
    // Sync points the problem link at the contest of your latest accepted submission.
    const contestId = p.url ? /atcoder\.jp\/contests\/([^/]+)/.exec(p.url)?.[1] : undefined;
    return contestId ? `https://atcoder.jp/contests/${contestId}/submissions/${p.submissionId}` : null;
  }
  return null;
}
