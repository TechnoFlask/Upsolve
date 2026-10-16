# Upsolve

Personal tracker for competitive-programming progress across Codeforces, LeetCode and AtCoder.
See [SPEC.md](SPEC.md) for the full design.

## Setup

```bash
bun install
cp .env.example .env.local
bun hash-passcode "<your passcode>"   # paste both printed lines into .env.local
bun db:migrate
bun dev
```

Open http://localhost:3000 and unlock with your passcode.

## Scripts

| Command | What it does |
|---|---|
| `bun dev` | Dev server |
| `bun db:generate` | Create a migration after editing `src/db/schema.ts` |
| `bun db:migrate` | Apply migrations to `DATABASE_URL` |
| `bun db:studio` | Browse the database in Drizzle Studio |
| `bun hash-passcode "<pass>"` | Print `UPSOLVE_PASSCODE_HASH` and a fresh `AUTH_SECRET` |
