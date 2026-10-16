import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContestProblemName, ProblemLetter } from "@/components/problem-letter";
import { ProblemPaneProvider } from "@/components/problem-pane";
import { requireSession } from "@/lib/auth";
import { participationLabel, ratingDelta } from "@/lib/contest-labels";
import { getContest, type ContestProblemView } from "@/lib/contests";
import { formatDay } from "@/lib/dates";
import { listAllTags } from "@/lib/problems";
import { AddToUpsolveButton } from "./add-to-upsolve-button";

export default function ContestPage({ params }: PageProps<"/contests/[id]">) {
  return (
    <main className="pb-16">
      <Link href="/contests" className="mt-6 inline-block text-meta text-pencil hover:text-ink">
        All contests
      </Link>
      <Suspense fallback={<p className="pt-4 text-pencil">Loading contest…</p>}>
        <ContestDetail params={params} />
      </Suspense>
    </main>
  );
}

async function ContestDetail({ params }: Pick<PageProps<"/contests/[id]">, "params">) {
  await requireSession();
  const id = Number((await params).id);
  const [contest, tags] = await Promise.all([
    Number.isInteger(id) ? getContest(id) : null,
    listAllTags(),
  ]);
  if (!contest) notFound();

  const delta = ratingDelta(contest);
  return (
    <>
      <div className="pt-2 pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{contest.name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-3 text-pencil">
          {contest.date && <span className="tabular">{formatDay(contest.date)}</span>}
          <span>{participationLabel(contest)}</span>
          {contest.rank != null && <span className="tabular">Rank {contest.rank}</span>}
          {delta != null && (
            <span className={`tabular font-medium ${delta >= 0 ? "text-accepted" : "text-wrong"}`}>
              {delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`} ({contest.newRating})
            </span>
          )}
          {contest.url && (
            <a href={contest.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">
              Open on Codeforces
            </a>
          )}
        </div>
        <p className="mt-3">
          {contest.left === 0
            ? `You've solved all ${contest.problems.length} problems.`
            : `${contest.solved} of ${contest.problems.length} solved, ${contest.left} left.`}
        </p>
      </div>

      <ProblemPaneProvider allTags={tags}>
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-sheet">
          {contest.problems.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <ProblemLetter problem={p} />
              <div className="min-w-0 flex-1">
                <ContestProblemName problem={p} />
                <div className="text-meta text-pencil">{resultText(p)}</div>
              </div>
              {p.difficulty != null && <span className="tabular">{p.difficulty}</span>}
              {(p.state === "untried" || p.state === "attempted") && <AddToUpsolveButton contestProblemId={p.id} />}
            </li>
          ))}
        </ul>
      </ProblemPaneProvider>
    </>
  );
}

function resultText(p: ContestProblemView): string {
  const tries = `${p.tries} ${p.tries === 1 ? "try" : "tries"}`;
  switch (p.state) {
    case "during":
      return `Solved during the ${p.solvedDuring === "virtual" ? "virtual contest" : "contest"}, ${tries}`;
    case "upsolved":
      return p.solvedAt ? `Upsolved on ${formatDay(p.solvedAt)}, ${tries}` : "Upsolved";
    case "attempted":
      return `Attempted, ${tries}, not accepted yet`;
    case "queued":
      return p.tries > 0 ? `In your upsolve queue, ${tries} so far` : "In your upsolve queue";
    case "untried":
      return "Not tried";
  }
}
