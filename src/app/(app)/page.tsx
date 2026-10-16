import { Suspense } from "react";
import { ProblemList } from "@/components/problem-list";
import { requireSession } from "@/lib/auth";
import { listAllTags, listProblems, parseProblemFilters, problemCounts } from "@/lib/problems";

export default function ProblemsPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="pb-16">
      <Suspense fallback={<ProblemsSkeleton />}>
        <Problems searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Problems({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await requireSession();
  const raw = await searchParams;
  const filters = parseProblemFilters(raw);
  const [rows, counts, tags] = await Promise.all([
    listProblems(filters),
    problemCounts(),
    listAllTags(),
  ]);

  const params = Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  const filtered = Object.keys(params).some((k) => k !== "sort" && k !== "dir");

  return (
    <ProblemList
      problems={rows}
      allTags={tags}
      summary={summarize(counts)}
      isEmpty={counts.total === 0}
      filtered={filtered}
      sort={{ field: filters.sort, dir: filters.dir }}
      params={params}
    />
  );
}

function ProblemsSkeleton() {
  return (
    <div aria-busy className="pt-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Problems</h1>
      <p className="mt-1 text-pencil">Loading your problems…</p>
      <div className="mt-6 h-64 rounded-lg border border-rule bg-sheet" />
    </div>
  );
}

function summarize({ total, upsolve, revisit }: Awaited<ReturnType<typeof problemCounts>>) {
  if (total === 0) return "Codeforces, LeetCode and AtCoder problems, in one list.";
  const parts = [`${total} tracked`];
  if (upsolve) parts.push(`${upsolve} waiting to be upsolved`);
  if (revisit) parts.push(`${revisit} to revisit`);
  return parts.length === 1
    ? `${parts[0]}.`
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}.`;
}
