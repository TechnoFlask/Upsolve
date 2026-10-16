import Link from "next/link";
import { Suspense } from "react";
import { Heatmap, HeatmapLegend } from "@/components/dashboard/heatmap";
import { RatingChart } from "@/components/dashboard/rating-chart";
import { RatingHistogram } from "@/components/dashboard/rating-histogram";
import { TagTable } from "@/components/dashboard/tag-table";
import { requireSession } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard";
import { PLATFORM_NAMES, tierColor } from "@/lib/difficulty";

export default function DashboardPage() {
  return (
    <main className="pb-16">
      <Suspense
        fallback={
          <div className="pt-8">
            <h1 className="font-display text-4xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-pencil">Adding things up…</p>
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}

function Section(props: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-rule bg-sheet p-5 ${props.className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {props.aside}
      </div>
      {props.children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-pencil">{children}</p>;
}

async function Dashboard() {
  await requireSession();
  const d = await loadDashboard();

  return (
    <>
      <div className="pt-8 pb-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-pencil">{summary(d)}</p>
      </div>

      <div className="flex flex-col gap-5">
        <Section
          title="Activity"
          aside={<span className="text-meta text-pencil tabular">Longest streak: {d.streak.longest} {d.streak.longest === 1 ? "day" : "days"}</span>}
        >
          <Heatmap weeks={d.heatmap} />
          <div className="mt-3 flex justify-end">
            <HeatmapLegend />
          </div>
        </Section>

        {d.judges.map((j) => (
          <JudgeStats key={j.platform} judge={j} />
        ))}

        <Section title="Topics" aside={<span className="text-meta text-pencil">Your 15 most-practised tags</span>}>
          {d.tags.length ? (
            <TagTable stats={d.tags} />
          ) : (
            <Empty>
              Tags show up once your problems have them. <Link href="/sync" className="underline underline-offset-4">Sync Codeforces</Link> to get them automatically.
            </Empty>
          )}
        </Section>
      </div>
    </>
  );
}

type JudgeStatsData = Awaited<ReturnType<typeof loadDashboard>>["judges"][number];

function JudgeStats({ judge: j }: { judge: JudgeStatsData }) {
  const name = PLATFORM_NAMES[j.platform];
  const current = j.rating.at(-1)?.rating;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section
        title={`${name} rating`}
        aside={
          current != null && (
            <span className="text-meta tabular">
              <span className="font-semibold" style={{ color: tierColor(j.platform, current) }}>
                {current}
              </span>
              <span className="text-pencil">, max {j.maxRating}</span>
            </span>
          )
        }
      >
        {j.rating.length ? (
          <RatingChart points={j.rating} platform={j.platform} />
        ) : (
          <Empty>Your rating graph appears after your first rated contest.</Empty>
        )}
      </Section>

      <Section
        title={j.platform === "atcoder" ? "Solved by difficulty" : "Solved by rating"}
        aside={<span className="text-meta text-pencil">{name}</span>}
      >
        {j.buckets.length ? (
          <RatingHistogram buckets={j.buckets} platform={j.platform} />
        ) : (
          <Empty>Solve a rated {name} problem to see your spread here.</Empty>
        )}
      </Section>
    </div>
  );
}

function summary(d: Awaited<ReturnType<typeof loadDashboard>>): string {
  if (d.totalSolved === 0) return "Solve a few problems and your progress shows up here.";
  const week = d.solvedThisWeek ? `, ${d.solvedThisWeek} in the last 7 days` : "";
  const streak =
    d.streak.current > 0
      ? `You're on a ${d.streak.current}-day streak.`
      : "No streak right now. Solve one today to start one.";
  return `${d.totalSolved} solved${week}. ${streak}`;
}
