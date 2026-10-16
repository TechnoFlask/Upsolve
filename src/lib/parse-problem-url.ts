import type { Platform } from "./constants";

export type ParsedProblemUrl = { platform: Platform; externalId: string; name?: string };

// Recognises problem links from supported judges so the form can prefill itself.
export function parseProblemUrl(input: string): ParsedProblemUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "codeforces.com" || host === "codeforces.ml") {
    // /problemset/problem/1950/C, /contest/1950/problem/C, /gym/104114/problem/A
    if (parts[0] === "problemset" && parts[1] === "problem" && parts[2] && parts[3]) {
      return { platform: "codeforces", externalId: `${parts[2]}${parts[3]}` };
    }
    if ((parts[0] === "contest" || parts[0] === "gym") && parts[2] === "problem" && parts[1] && parts[3]) {
      return { platform: "codeforces", externalId: `${parts[1]}${parts[3]}` };
    }
  }

  if (host === "leetcode.com" || host === "leetcode.cn") {
    // /problems/two-sum/ or /problems/two-sum/description/
    if (parts[0] === "problems" && parts[1]) {
      const slug = parts[1];
      const name = slug
        .split("-")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
      return { platform: "leetcode", externalId: slug, name };
    }
  }

  if (host === "atcoder.jp") {
    // /contests/abc350/tasks/abc350_e
    if (parts[0] === "contests" && parts[2] === "tasks" && parts[3]) {
      return { platform: "atcoder", externalId: parts[3] };
    }
  }

  return null;
}
