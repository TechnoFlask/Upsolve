import Link from "next/link";
import { Suspense } from "react";
import { LetterLegend, ProblemLetter } from "@/components/problem-letter";
import { ProblemPaneProvider } from "@/components/problem-pane";
import { requireSession } from "@/lib/auth";
import { listAllTags } from "@/lib/problems";
import { participationLabel, ratingDelta } from "@/lib/contest-labels";
import { listContests, parseContestFilters, type ContestView } from "@/lib/contests";
import { formatDay } from "@/lib/dates";
import { PLATFORM_NAMES } from "@/lib/difficulty";
import { ContestFilterBar } from "./contest-filter-bar";

export default function ContestsPage({ searchParams }: PageProps<"/contests">) {
  return (
    <main className="pb-16">
      <Suspense
        fallback={
          <div className="pt-8">
            <h1 className="font-display text-4xl font-semibold tracking-tight">Contests</h1>
            <p className="mt-1 text-pencil">Loading your contests…</p>
          </div>
        }
      >
        <Contests searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Contests({ searchParams }: Pick<PageProps<"/contests">, "searchParams">) {
  await requireSession();
  const raw = await searchParams;
  const [{ all, shown }, tags] = await Promise.all([listContests(parseContestFilters(raw)), listAllTags()]);
  const params = Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  // Only worth naming the judge once you have contests on more than one.
  const judges = [...new Set(all.map((c) => c.platform))];

  return (
    <>
      <div className="pt-8 pb-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Contests</h1>
        <p className="mt-1 text-pencil">{summarize(all)}</p>
      </div>

      {all.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule bg-sheet px-6 py-14 text-center">
          <p className="font-medium">No contests yet.</p>
          <p className="mx-auto mt-1 max-w-md text-pencil">
            Sync your Codeforces or AtCoder account and every contest you took part in, did
            virtually or solved a problem from shows up here.
          </p>
          <Link href="/sync" className="mt-5 inline-flex h-10 items-center rounded-md border border-ink px-4 font-medium hover:bg-paper">
            Go to Sync
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <ContestFilterBar params={params} judges={judges} />
            <LetterLegend />
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-rule bg-sheet">
            {shown.length === 0 ? (
              <p className="px-4 py-10 text-center text-pencil">No contests match these filters.</p>
            ) : (
              <ProblemPaneProvider allTags={tags}>
                <ul className="divide-y divide-rule">
                  {shown.map((c) => (
                    <ContestRow key={c.id} contest={c} showJudge={judges.length > 1} />
                  ))}
                </ul>
              </ProblemPaneProvider>
            )}
          </div>
        </>
      )}
    </>
  );
}

function ContestRow({ contest: c, showJudge }: { contest: ContestView; showJudge: boolean }) {
  const delta = ratingDelta(c);
  return (
    <li className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="min-w-0">
        <Link href={`/contests/${c.id}`} className="font-semibold underline-offset-4 hover:underline">
          {c.name}
        </Link>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-meta text-pencil">
          {showJudge && <span>{PLATFORM_NAMES[c.platform]}</span>}
          {c.date && <span className="tabular">{formatDay(c.date)}</span>}
          <span>{participationLabel(c)}</span>
          {c.rank != null && <span className="tabular">Rank {c.rank}</span>}
          {delta != null && (
            <span className={`tabular font-medium ${delta >= 0 ? "text-accepted" : "text-wrong"}`}>
              {delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {c.problems.map((p) => (
          <ProblemLetter key={p.id} problem={p} />
        ))}
        <span className="tabular ml-2 text-meta text-pencil">
          {c.solved}/{c.problems.length}
        </span>
      </div>
    </li>
  );
}

function summarize(all: ContestView[]): string {
  if (all.length === 0) return "Every contest you've taken part in, with what's left to upsolve.";
  const left = all.reduce((n, c) => n + c.left, 0);
  const contestWord = all.length === 1 ? "contest" : "contests";
  const leftText =
    left === 0
      ? "Nothing left to upsolve."
      : `${left} ${left === 1 ? "problem" : "problems"} left to upsolve.`;
  return `${all.length} ${contestWord}. ${leftText}`;
}
