import Link from "next/link";
import { Suspense } from "react";
import { ProblemPaneProvider } from "@/components/problem-pane";
import { aiConfigured } from "@/lib/ai/model";
import { requireSession } from "@/lib/auth";
import { formatDay, startOfDay } from "@/lib/dates";
import { SLOT_LABEL, type Outcome } from "@/lib/practice/planner";
import { codeforcesHandle, getPlan, recentPlans, today, type PlanItemView, type PlanView } from "@/lib/practice/service";
import { listAllTags } from "@/lib/problems";
import { CheckProgressButton, PlanItemName, PlanTodayForm, SwapButton } from "./today-controls";

export default function TodayPage() {
  return (
    <main className="max-w-3xl pb-16">
      <Suspense
        fallback={
          <div className="pt-8">
            <h1 className="font-display text-4xl font-semibold tracking-tight">Today</h1>
            <p className="mt-1 text-pencil">Loading your plan…</p>
          </div>
        }
      >
        <Today />
      </Suspense>
    </main>
  );
}

const OUTCOME: Record<Outcome, { label: string; mark: string }> = {
  clean: { label: "Solved", mark: "border-accepted bg-accepted" },
  editorial: { label: "Solved with the editorial", mark: "border-accepted bg-sheet" },
  attempted: { label: "Attempted", mark: "border-wrong bg-sheet" },
  untouched: { label: "Not started", mark: "border-rule bg-sheet" },
};

async function Today() {
  await requireSession();
  const day = today();
  const [handle, plan, history, tags] = await Promise.all([codeforcesHandle(), getPlan(day), recentPlans(day), listAllTags()]);

  return (
    <ProblemPaneProvider allTags={tags}>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Today</h1>
          <p className="mt-1 text-pencil">{formatDay(startOfDay(day))}</p>
        </div>
        {plan && <CheckProgressButton />}
      </div>

      {!handle ? (
        <div className="rounded-lg border border-dashed border-rule bg-sheet px-6 py-10">
          <p className="font-medium">Connect Codeforces first.</p>
          <p className="mt-1 text-pencil">The daily plan is built from your solve history.</p>
          <Link href="/sync" className="mt-4 inline-flex h-10 items-center rounded-md border border-ink px-4 font-medium hover:bg-paper">
            Go to Sync
          </Link>
        </div>
      ) : plan ? (
        <TodaysPlan plan={plan} />
      ) : (
        <section className="rounded-lg border border-rule bg-sheet p-6">
          <h2 className="text-lg font-semibold">Plan today&apos;s practice</h2>
          <p className="mt-1 mb-5 max-w-prose text-pencil">
            You get a warm-up at your level, core problems a step or two above it, one on a topic you need work
            on and a stretch, picked from problems you haven&apos;t seen.{" "}
            {aiConfigured() ? "The coach explains each choice." : "Add an OpenRouter key to have the AI coach pick and explain them."}
          </p>
          <PlanTodayForm defaultSize={history[0]?.size ?? 5} aiReady={aiConfigured()} />
        </section>
      )}

      {history.length > 0 && <History plans={history} />}
    </ProblemPaneProvider>
  );
}

function TodaysPlan({ plan }: { plan: PlanView }) {
  const required = plan.items.filter((i) => i.slot !== "upsolve");
  const done = required.filter((i) => i.outcome === "clean" || i.outcome === "editorial").length;
  return (
    <>
      <div className="mb-5">
        <p className="tabular">
          Level {plan.level}.{" "}
          {required.length > 0 && done === required.length
            ? `All ${required.length} done. Nice work.`
            : `${done} of ${required.length} done.`}
        </p>
        {plan.theme && <p className="mt-3 text-xl font-semibold">{plan.theme}</p>}
        {plan.coachNote && <p className="mt-2 max-w-prose leading-relaxed text-pencil">{plan.coachNote}</p>}
      </div>
      <ol className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-sheet">
        {plan.items.map((item) => (
          <PlanRow key={item.id} item={item} />
        ))}
      </ol>
    </>
  );
}

function PlanRow({ item }: { item: PlanItemView }) {
  const outcome = OUTCOME[item.outcome];
  const solved = item.outcome === "clean" || item.outcome === "editorial";
  return (
    <li className="flex gap-4 px-4 py-4">
      <span aria-hidden className={`mt-1.5 size-3.5 shrink-0 rounded-full border-2 ${outcome.mark}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 text-meta text-pencil">
          <span>
            {SLOT_LABEL[item.slot]}
            {item.slot === "weak" && item.focusTag ? `: ${item.focusTag}` : ""}
            {item.slot === "upsolve" ? " (optional)" : ""}
          </span>
          {item.difficulty != null && <span className="tabular">{item.difficulty}</span>}
        </div>
        <div className="mt-0.5">
          <PlanItemName name={item.name} url={item.url} difficulty={item.difficulty} tracked={item.tracked} solved={solved} />
        </div>
        <p className="mt-1 leading-relaxed">{item.reason}</p>
        {item.tags.length > 0 && <p className="mt-1 text-meta text-pencil">{item.tags.join(", ")}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 text-right text-meta">
        <span className={item.outcome === "attempted" ? "text-wrong" : solved ? "text-accepted" : "text-pencil"}>
          {outcome.label}
          {item.outcome === "attempted" && item.tracked ? `, ${item.tracked.tries} ${item.tracked.tries === 1 ? "try" : "tries"}` : ""}
        </span>
        {item.outcome === "untouched" && <SwapButton itemId={item.id} />}
      </div>
    </li>
  );
}

function History({ plans }: { plans: PlanView[] }) {
  const oldest = plans.at(-1)!;
  const newest = plans[0];
  const trend =
    newest.level > oldest.level
      ? `Your level rose from ${oldest.level} to ${newest.level} over these days.`
      : newest.level < oldest.level
        ? `Your level eased from ${oldest.level} to ${newest.level} to consolidate.`
        : `Your level has held at ${newest.level}.`;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Recent days</h2>
      <p className="mt-1 text-pencil">{plans.length > 1 ? trend : "Your first plans build up here."}</p>
      <ul className="mt-4 divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-sheet">
        {plans.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="w-28 tabular">{formatDay(startOfDay(p.day))}</span>
            <span className="w-20 text-meta text-pencil tabular">Level {p.level}</span>
            <span className="flex gap-1.5" aria-label={`${p.done} of ${p.items.length} solved`}>
              {p.items.map((i) => (
                <span
                  key={i.id}
                  title={`${SLOT_LABEL[i.slot]}: ${i.name} (${i.difficulty ?? "?"}), ${OUTCOME[i.outcome].label.toLowerCase()}`}
                  className={`size-3.5 rounded-full border-2 ${OUTCOME[i.outcome].mark}`}
                />
              ))}
            </span>
            <span className="ml-auto text-meta text-pencil tabular">
              {p.done}/{p.items.length}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
