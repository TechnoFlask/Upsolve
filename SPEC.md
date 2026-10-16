# Upsolve — spec

A personal, single-user tracker that aggregates competitive-programming progress across
Codeforces, LeetCode, AtCoder (and more later) into one filterable web app.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript, Tailwind CSS |
| Package manager / scripts | Bun (Next.js itself runs on Node, locally and on Vercel) |
| Hosting | Vercel (Hobby) |
| Database | SQLite via libSQL — local `.db` file in dev, Turso in production (same code, different URL) |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Validation | zod |
| AI | Vercel AI SDK (`generateText` + `Output.object`) with the OpenRouter provider; key server-side only |

## Access control (single user)

- One master passcode. Only its scrypt hash lives in env (`UPSOLVE_PASSCODE_HASH`); generate it with
  `bun hash-passcode`.
- `/unlock` page → on success the server sets an httpOnly, Secure, SameSite=Lax cookie holding an
  expiry plus an HMAC signature (`AUTH_SECRET`). Valid for 30 days.
- `src/proxy.ts` redirects every request without a valid cookie to `/unlock` (API routes get 401).
- Server actions and route handlers re-verify the session themselves (proxy is only the first gate).
- Failed attempts are recorded in the DB; more than 5 failures per IP in 15 minutes → locked out
  until the window passes.

## Data model

### `problems`
| Field | Notes |
|---|---|
| `platform` | `codeforces` \| `leetcode` \| `atcoder` \| `other` |
| `externalId` | Platform's ID, e.g. `1950C`, `two-sum`, `abc350_c`. Unique with `platform`. |
| `name`, `url` | Display name and link to the problem on its platform |
| `difficulty` | Numeric where available (CF rating, AtCoder estimated difficulty); LC mapped Easy=1, Medium=2, Hard=3 for sorting |
| `difficultyLabel` | Human label: `1600`, `Medium`, `400 pts` |
| `tags` | JSON string array |
| `status` | `solved` \| `attempted` \| `upsolve` \| `revisit` |
| `tries` | Number of submissions/attempts |
| `usedEditorial` | Whether the editorial/solution was checked |
| `solvedAt` | Date of first accepted solution (nullable) |
| `notes` | Free-text notes (key idea, pitfalls) |
| `aiApproach`, `aiModel` | Generated pseudo-code / hints and the model that produced it; hidden behind a reveal |
| `contestId`, `solvedInContest` | Optional link to a contest, and whether it was solved live or upsolved |
| `source` | `manual` \| `sync` — synced rows never overwrite user-entered notes/status edits |

### `contests`
`platform`, `externalId`, `name`, `url`, `date`, `rank`, `oldRating`, `newRating`, `notes`.
Unique on (`platform`, `externalId`).

### `accounts`
Per-platform handle and `lastSyncedAt`.

### `login_attempts`
`ip`, `at` — for passcode rate limiting.

## Platform sync

| Platform | Source | What we get |
|---|---|---|
| Codeforces | Official API: `user.status`, `user.rating`, `problemset.problems` | Full submission history (→ tries, first AC date), rating, tags; contest rating history |
| AtCoder | AtCoder Problems (kenkoooo): `user/submissions` (500 per page), `merged-problems`, `problem-models`, `contests`, `contest-problem`; plus `atcoder.jp/users/{u}/history/json` | Submissions (→ tries, first AC, in-contest or not), difficulty estimates clipped like AtCoder Problems shows them (below 400 squashed towards 0), contest history with rank and rating. No tags. Virtual participations aren't exposed. Contest names prefer the English name. Long-running practice sets (APG4b, abs) aren't contests. A problem links to the contest you last solved it in (shared ABC/ARC problems). |
| LeetCode | Unofficial GraphQL (`recentAcSubmissionList`, `userContestRankingHistory`) | Only ~20 most recent ACs → sync often; older ones via manual / quick-add-by-URL |

- "Sync now" button per platform plus a daily Vercel Cron job. Codeforces allows one call per 2 s, AtCoder Problems asks for > 1 s between calls; both are throttled.
- An AtCoder username with no submissions and no contests is rejected rather than saved, because AtCoder can't tell an unknown user from a new one.
- Sync is an upsert: it fills platform facts (name, url, difficulty, tags, tries, solvedAt, latest accepted
  submission) but never clobbers fields the user edited (notes, status, usedEditorial, solution code, analysis).
- Unsolved contest problems are added to the upsolve queue on request ("Add to upsolve queue"), not automatically.

## Views

0. **Today** (home after unlocking) — the daily practice plan. See "Daily practice planner" below.
1. **Problems table** — columns: problem, platform (with its ID), difficulty, status, tries, tags, solved date.
   Excel-style filters in each column header: platform; status and editorial used; difficulty range; tries
   (first try / 2–3 / 4+ or a range); tags (all or any of them, searchable); solved date (last 7 / 30 days,
   this year or a range) and solved during a live contest, virtual or practice. Active filters show as
   removable chips above the table; on phones a Filters panel holds them all, plus sort. Sortable by any
   column but status and tags; full-text search on name/ID/notes; all state lives in the URL. Add/edit
   drawer; quick-add by pasting a problem URL.
2. **Upsolve / revisit queue** — problems with status `upsolve` or `revisit`.
3. **Contests** — every contest you took part in live, unofficially or virtually, or solved any problem
   from, with rank and rating change. Each row shows the contest's full problem set as letters coloured by
   your result (solved during the contest / upsolved / attempted / queued / not tried), filterable by judge once
   there are contests on more than one. The detail page
   lists each problem with an "Add to upsolve queue" button. Data: `contests` + `contest_problems`
   (the full set from `problemset.problems`), joined to `problems` for your status. Gym contests are not
   shown yet.
4. **Dashboard** — daily solve heatmap with current/longest streak; per judge (Codeforces always, AtCoder once
   synced) a rating graph over its tier bands and a solved-by-rating histogram (tier-coloured); and per-tag solved/unsolved with weak topics flagged
   (≥2 problems and under 60% solved, or editorial used on half or more).
5. **Solution analysis** (in the problem side pane) — paste your accepted code (the pane links to your
   latest accepted submission; Codeforces' submission pages are behind a Cloudflare bot check, so the app
   can't fetch the code itself). An OpenRouter model returns pseudo-code mirroring your solution, its time and
   space complexity, whether it's optimal, and if not the optimal bounds plus 2–4 progressive hints revealed
   one at a time. It also names 1–4 topics the solution uses, from Codeforces' tag vocabulary (anything else is
   dropped); each can be added as a tag in one click, or all at once. That's how AtCoder and LeetCode problems, which
   have no tags of their own, get topics for filters and the dashboard. Code and analysis are stored on the problem. Calls can take up to ~60s; on Vercel the
   function needs a long enough `maxDuration`.

Mobile-friendly layout throughout (used from phone).

## Daily practice planner

Code decides what's eligible; the AI only chooses among real, vetted problems and explains why.
Plans are built from Codeforces only for now; AtCoder solves count towards the dashboard but not the level.

- **Catalogue**: every sync stores Codeforces' full problemset with solve counts (`problemset` table).
- **Level** (the rating you solve comfortably) = 75th percentile of your no-editorial Codeforces solves in
  the last 60 days (all time if fewer than 5), min 800. It then adapts: over the last 3 plans at the current
  level, core/stretch problems you touched score clean = 1, with editorial = 0.5, attempted = 0 (stretch ×1.5).
  Average ≥ 0.75 → +100, ≤ 0.3 → −100, needs ≥ 3 scored. Untouched problems don't count. Never below the estimate.
- **Slots** (Light 3 / Regular 5 / Intense 7): warm-up at level; core at +100/+200; weak spot at level on a
  focus topic (a tag flagged weak, else the least-practised level-appropriate curriculum tag); stretch at +300;
  plus an optional upsolve (earlier plan problems attempted but unsolved, then the upsolve queue, then other
  attempted problems) on Regular/Intense.
- **Candidates** per slot: exactly the target rating, not `*special`, never tracked or suggested in the last
  60 days, no same-name duplicates (Div 1/Div 2 copies); ranked by log(solve count) + contest recency, top 30
  shuffled with a day-based seed, 6 offered.
- **Coach** (AI, optional): gets your profile and the shortlists; returns a theme, a short coaching note and
  one pick + reason per slot. Picks not in that slot's shortlist, or duplicates, fall back to the
  deterministic pick. Without a key, or if the call fails, the whole plan is picked by rules with template reasons.
- **Progress**: item status comes live from your tracked problems (solved / with editorial / attempted /
  not started); "Check progress" re-syncs. Unstarted items can be swapped for another fitting problem.
- **History**: recent days with level and per-problem outcome, and the level trend.

## Build phases

1. ~~**Foundation**~~ — done.
2. **Sync** — Codeforces and AtCoder done (problems + contests); LeetCode to do.
3. ~~**Contests + dashboard**~~ — done.
4. ~~**AI solution analysis**~~ — done.
5. **Deploy** — Turso DB, Vercel env vars, daily cron.

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | `file:./data/upsolve.db` locally, `libsql://…turso.io` in prod |
| `DATABASE_AUTH_TOKEN` | Turso token (prod only) |
| `UPSOLVE_PASSCODE_HASH` | Output of `bun hash-passcode` |
| `AUTH_SECRET` | Random 32+ byte secret for cookie signing |
| `NEXT_PUBLIC_TIMEZONE` | IANA zone used to display solve dates (default `Asia/Kolkata`) |
| `OPENROUTER_API_KEY` | Solution analysis |
| `OPENROUTER_MODEL` | Optional, default `anthropic/claude-sonnet-5.5` |
| `CRON_SECRET` | Deploy phase, authenticates Vercel Cron calls |
