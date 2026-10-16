"use client";

import { useState, useTransition } from "react";
import { planTodayAction, swapItemAction, syncProgressAction, type TodayActionResult } from "@/app/today/actions";
import { useOpenProblem } from "@/components/problem-pane";
import { OpenLink } from "@/components/open-link";
import type { Problem } from "@/db/schema";
import { tierColor } from "@/lib/difficulty";

const SIZES = [
  { value: 3, label: "Light", detail: "3 problems" },
  { value: 5, label: "Regular", detail: "5 problems" },
  { value: 7, label: "Intense", detail: "7 problems" },
];

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TodayActionResult | null>(null);
  const run = (fn: () => Promise<TodayActionResult>) => start(async () => setResult(await fn()));
  return { pending, result, run };
}

export function PlanTodayForm({ defaultSize, aiReady }: { defaultSize: number; aiReady: boolean }) {
  const [size, setSize] = useState(defaultSize);
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-meta text-pencil">How much time do you have today?</legend>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <label
              key={s.value}
              className="flex cursor-pointer flex-col rounded-md border border-rule px-4 py-2 has-checked:border-ink has-checked:bg-paper has-focus-visible:outline-2 has-focus-visible:outline-revisit"
            >
              <input type="radio" name="size" value={s.value} checked={size === s.value} onChange={() => setSize(s.value)} className="sr-only" />
              <span className="font-medium">{s.label}</span>
              <span className="text-meta text-pencil">{s.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => planTodayAction(size))}
          className="h-10 rounded-md bg-accepted px-4 font-medium text-white hover:bg-accepted-dark disabled:opacity-60"
        >
          {pending ? "Planning…" : "Plan my day"}
        </button>
        {pending && (
          <span className="text-meta text-pencil">
            Syncing Codeforces{aiReady ? " and asking the coach" : ""}. This takes up to a minute.
          </span>
        )}
      </div>
      <ActionMessage result={result} />
    </div>
  );
}

export function CheckProgressButton() {
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(syncProgressAction)}
        className="h-9 rounded-md border border-ink px-3 text-meta font-medium hover:bg-sheet disabled:opacity-60"
      >
        {pending ? "Checking…" : "Check progress"}
      </button>
      {result && !result.ok && <ActionMessage result={result} />}
    </div>
  );
}

export function SwapButton({ itemId }: { itemId: number }) {
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => swapItemAction(itemId))}
        className="text-meta text-pencil underline-offset-4 hover:text-ink hover:underline disabled:opacity-60"
      >
        {pending ? "Swapping…" : "Swap"}
      </button>
      {result && !result.ok && <ActionMessage result={result} />}
    </div>
  );
}

function ActionMessage({ result }: { result: TodayActionResult | null }) {
  if (!result) return null;
  if (!result.ok) return <p role="alert" className="text-meta text-wrong">{result.error}</p>;
  return result.notice ? <p className="text-meta text-amber">{result.notice}</p> : null;
}

/** Solved: open your notes in the side pane. Otherwise: go solve it on Codeforces. */
export function PlanItemName(props: { name: string; url: string | null; difficulty: number | null; tracked: Problem | null; solved: boolean }) {
  const openProblem = useOpenProblem();
  const className = "text-left font-semibold underline-offset-4 hover:underline";
  const style = { color: tierColor("codeforces", props.difficulty) };
  return (
    <span className="inline-flex items-center gap-2">
      {props.solved && props.tracked ? (
        <button type="button" onClick={() => openProblem(props.tracked!)} className={className} style={style}>
          {props.name}
        </button>
      ) : (
        <a href={props.url ?? undefined} target="_blank" rel="noreferrer" className={className} style={style}>
          {props.name}
        </a>
      )}
      <OpenLink url={props.url} name={props.name} />
    </span>
  );
}
