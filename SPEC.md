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
| AI helper | OpenRouter (key server-side only) |

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
| AtCoder | Community AtCoder Problems API (kenkoooo) + `atcoder.jp/users/{u}/history/json` | Submissions, estimated difficulty; contest history |
| LeetCode | Unofficial GraphQL (`recentAcSubmissionList`, `userContestRankingHistory`) | Only ~20 most recent ACs → sync often; older ones via manual / quick-add-by-URL |

- "Sync now" button per platform plus a daily Vercel Cron job.
- Sync is an upsert: it fills platform facts (name, url, difficulty, tags, tries, solvedAt) but never
  clobbers fields the user edited (notes, status, usedEditorial, AI approach).
- Unsolved problems from a participated contest land in status `upsolve`.

## Views

1. **Problems table** — sort, filter (platform, tag, difficulty range, status, date range, editorial used),
   full-text search on name/ID/notes; add/edit drawer; quick-add by pasting a problem URL.
2. **Upsolve / revisit queue** — problems with status `upsolve` or `revisit`.
3. **Contests** — every contest you took part in live, unofficially or virtually, or solved any problem
   from, with rank and rating change. Each row shows the contest's full problem set as letters coloured by
   your result (solved during the contest / upsolved / attempted / queued / not tried). The detail page
   lists each problem with an "Add to upsolve queue" button. Data: `contests` + `contest_problems`
   (the full set from `problemset.problems`), joined to `problems` for your status. Gym contests are not
   shown yet.
4. **Dashboard** — solves over time, streak heatmap, tag breakdown (weak topics), rating graphs per platform.
5. **Problem detail** — notes, metadata, "Generate approach" (AI, hidden until revealed).

Mobile-friendly layout throughout (used from phone).

## Build phases

1. **Foundation** — project scaffold, DB schema + migrations, passcode lock, problems table with manual add/edit, filters.
2. **Codeforces + AtCoder sync** (incl. quick-add by URL).
3. **LeetCode sync.**
4. **Contests + dashboard.**
5. **AI approach helper** (OpenRouter).
6. **Deploy** — Turso DB, Vercel env vars, daily cron.

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | `file:./data/upsolve.db` locally, `libsql://…turso.io` in prod |
| `DATABASE_AUTH_TOKEN` | Turso token (prod only) |
| `UPSOLVE_PASSCODE_HASH` | Output of `bun hash-passcode` |
| `AUTH_SECRET` | Random 32+ byte secret for cookie signing |
| `NEXT_PUBLIC_TIMEZONE` | IANA zone used to display solve dates (default `Asia/Kolkata`) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Phase 5 |
| `CRON_SECRET` | Phase 6, authenticates Vercel Cron calls |
