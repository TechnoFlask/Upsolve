"use client";

import type { ContestProblemView, ProblemState } from "@/lib/contests";
import { tierColor } from "@/lib/difficulty";
import { OpenLink } from "./open-link";
import { useOpenProblem } from "./problem-pane";

export const STATE_TEXT: Record<ProblemState, string> = {
  during: "solved during the contest",
  upsolved: "upsolved",
  attempted: "attempted, not solved",
  queued: "in your upsolve queue",
  untried: "not tried",
};

const STATE_CLASS: Record<ProblemState, string> = {
  during: "border-accepted bg-accepted text-white",
  upsolved: "border-accepted bg-sheet text-accepted",
  attempted: "border-wrong bg-sheet text-wrong",
  queued: "border-amber bg-sheet text-amber border-dashed",
  untried: "border-rule bg-sheet text-pencil",
};

/**
 * Solved problems open your notes in the side pane; anything not solved yet
 * opens on the judge so you can go and solve it.
 */
function useProblemAction(p: ContestProblemView) {
  const openProblem = useOpenProblem();
  const solved = p.state === "during" || p.state === "upsolved";
  if (solved && p.tracked) {
    const tracked = p.tracked;
    return { kind: "pane" as const, open: () => openProblem(tracked) };
  }
  return { kind: "judge" as const, href: p.url };
}

/** A problem's index styled by your result on it, as on a standings row. */
export function ProblemLetter({ problem: p }: { problem: ContestProblemView }) {
  const action = useProblemAction(p);
  const className = `inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-meta font-semibold tabular hover:ring-2 hover:ring-rule ${STATE_CLASS[p.state]}`;
  const label = `${p.index}, ${p.name}: ${STATE_TEXT[p.state]}. ${action.kind === "pane" ? "Show your notes" : "Open on the judge"}`;

  if (action.kind === "pane") {
    return (
      <button type="button" onClick={action.open} title={label} aria-label={label} className={className}>
        {p.index}
      </button>
    );
  }
  return action.href ? (
    <a href={action.href} target="_blank" rel="noreferrer" title={label} aria-label={label} className={className}>
      {p.index}
    </a>
  ) : (
    <span title={label} aria-label={label} className={className}>
      {p.index}
    </span>
  );
}

/** Problem name in rating-tier ink, with the same pane-or-judge behaviour, plus a direct judge link. */
export function ContestProblemName({ problem: p }: { problem: ContestProblemView }) {
  const action = useProblemAction(p);
  const className = "text-left font-semibold underline-offset-4 hover:underline";
  const style = { color: tierColor("codeforces", p.difficulty) };

  return (
    <span className="inline-flex items-center gap-2">
      {action.kind === "pane" ? (
        <button type="button" onClick={action.open} className={className} style={style}>
          {p.name}
        </button>
      ) : (
        <a href={action.href ?? undefined} target="_blank" rel="noreferrer" className={className} style={style}>
          {p.name}
        </a>
      )}
      <OpenLink url={p.url} name={p.name} />
    </span>
  );
}

export function LetterLegend() {
  const items: { state: ProblemState; label: string }[] = [
    { state: "during", label: "Solved during the contest" },
    { state: "upsolved", label: "Upsolved" },
    { state: "attempted", label: "Attempted" },
    { state: "queued", label: "Queued" },
    { state: "untried", label: "Not tried" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-meta text-pencil">
      {items.map((i) => (
        <li key={i.state} className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block size-3.5 rounded-sm border ${STATE_CLASS[i.state]}`} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
