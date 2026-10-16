"use client";

import { useState, useTransition } from "react";
import { addTagsAction, analyzeSolutionAction } from "@/app/problems/analysis-actions";
import type { Problem } from "@/db/schema";
import { suggestedTagsOf, type SolutionAnalysis } from "@/lib/analysis-schema";
import { formatDay } from "@/lib/dates";
import { PLATFORM_NAMES } from "@/lib/difficulty";
import { submissionUrl } from "@/lib/judge-links";

type Saved = { analysis: SolutionAnalysis; model: string | null; analyzedAt: Date | null };

/**
 * Your accepted code and the model's read of it: pseudo-code, complexity,
 * and, when it isn't optimal, hints toward the better bound.
 */
export function SolutionPanel({
  problem,
  tags,
  onTagsAccepted,
}: {
  problem: Problem;
  /** The problem's tags as currently in the form. */
  tags: string[];
  onTagsAccepted: (tags: string[]) => void;
}) {
  const [code, setCode] = useState(problem.solutionCode ?? "");
  const [saved, setSaved] = useState<Saved | null>(
    problem.analysis ? { analysis: problem.analysis, model: problem.analysisModel, analyzedAt: problem.analyzedAt } : null,
  );
  const [editing, setEditing] = useState(!problem.analysis);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const link = submissionUrl(problem);

  function analyze() {
    setError(null);
    startTransition(async () => {
      const result = await analyzeSolutionAction(problem.id, code);
      if (result.ok) {
        setSaved({ analysis: result.analysis, model: result.model, analyzedAt: result.analyzedAt });
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section aria-labelledby="solution-heading" className="rounded-lg border border-rule p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="solution-heading" className="font-semibold">
          Your solution
        </h3>
        {saved && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-meta text-pencil hover:text-ink">
            Change code
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-meta text-pencil">
            {link ? (
              <>
                Copy your accepted code from{" "}
                <a href={link} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">
                  your submission on {PLATFORM_NAMES[problem.platform]}
                </a>
                {problem.submissionLanguage ? ` (${problem.submissionLanguage})` : ""} and paste it here.
              </>
            ) : (
              "Paste your accepted code here."
            )}
          </p>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={10}
            spellCheck={false}
            aria-label="Your solution's code"
            placeholder="int main() { … }"
            className="w-full rounded-md border border-rule bg-paper/40 px-3 py-2 font-mono text-[0.8125rem] leading-relaxed outline-none focus:border-ink"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={analyze}
              disabled={pending || !code.trim()}
              className="h-9 rounded-md border border-ink px-3 text-meta font-medium hover:bg-paper disabled:opacity-50"
            >
              {pending ? "Analyzing…" : saved ? "Analyze again" : "Analyze solution"}
            </button>
            {pending && <span className="text-meta text-pencil">This can take up to a minute.</span>}
            {saved && !pending && (
              <button type="button" onClick={() => setEditing(false)} className="text-meta text-pencil hover:text-ink">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-meta text-wrong">
          {error}
        </p>
      )}

      {saved && !editing && (
        <AnalysisView saved={saved}>
          <SuggestedTags problemId={problem.id} suggested={suggestedTagsOf(saved.analysis)} tags={tags} onAccepted={onTagsAccepted} />
        </AnalysisView>
      )}
    </section>
  );
}

function AnalysisView({ saved, children }: { saved: Saved; children: React.ReactNode }) {
  const a = saved.analysis;
  const [shownHints, setShownHints] = useState(0);

  return (
    <div className="mt-3 flex flex-col gap-4">
      <p className="leading-relaxed">{a.approach}</p>

      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-meta text-pencil">Time</dt>
          <dd className="font-semibold tabular">{a.time}</dd>
        </div>
        <div>
          <dt className="text-meta text-pencil">Space</dt>
          <dd className="font-semibold tabular">{a.space}</dd>
        </div>
        <p className="col-span-2 text-meta text-pencil">{a.complexityReasoning}</p>
      </dl>

      {a.isOptimal ? (
        <p className="text-accepted">This is optimal for the problem.</p>
      ) : (
        <div className="rounded-md bg-amber/10 p-3">
          <p>
            <span className="text-amber font-semibold">Can be improved</span> to{" "}
            <span className="font-semibold tabular">{a.optimalTime}</span> time and{" "}
            <span className="font-semibold tabular">{a.optimalSpace}</span> space.
          </p>
          {a.hints.length > 0 && (
            <div className="mt-2">
              <ol className="flex list-decimal flex-col gap-1.5 pl-5">
                {a.hints.slice(0, shownHints).map((h, i) => (
                  <li key={i} className="leading-relaxed">
                    {h}
                  </li>
                ))}
              </ol>
              {shownHints < a.hints.length && (
                <button
                  type="button"
                  onClick={() => setShownHints((n) => n + 1)}
                  className="mt-2 text-meta font-medium underline underline-offset-4"
                >
                  {shownHints === 0 ? "Show a hint" : `Show hint ${shownHints + 1} of ${a.hints.length}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {children}

      <details open className="group">
        <summary className="cursor-pointer text-meta text-pencil hover:text-ink">Pseudo-code</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-paper/60 p-3 font-mono text-[0.8125rem] leading-relaxed whitespace-pre">
          {a.pseudocode}
        </pre>
      </details>

      {a.assumptions && <p className="text-meta text-pencil">Assumed: {a.assumptions}</p>}

      {saved.analyzedAt && (
        <p className="text-meta text-pencil">
          Analyzed by {saved.model ?? "the model"} on {formatDay(saved.analyzedAt)}.
        </p>
      )}
    </div>
  );
}

/** The topics the analysis saw in your solution; tags the problem lacks can be added in one click. */
function SuggestedTags(props: { problemId: number; suggested: string[]; tags: string[]; onAccepted: (tags: string[]) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (props.suggested.length === 0) return null;
  const missing = props.suggested.filter((t) => !props.tags.includes(t));

  function accept(tags: string[]) {
    setError(null);
    startTransition(async () => {
      const result = await addTagsAction(props.problemId, tags);
      if (result.ok) props.onAccepted(tags);
      else setError(result.error);
    });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-meta text-pencil">Topics your solution uses</p>
        {missing.length > 1 && (
          <button type="button" disabled={pending} onClick={() => accept(missing)} className="text-meta font-medium underline underline-offset-4 disabled:opacity-50">
            Add all as tags
          </button>
        )}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-1.5 text-meta">
        {props.suggested.map((t) =>
          props.tags.includes(t) ? (
            <li key={t} className="flex h-7 items-center gap-1 rounded-md bg-accepted/10 px-2 text-accepted">
              <span aria-hidden>✓</span>
              {t}
              <span className="sr-only">(already a tag)</span>
            </li>
          ) : (
            <li key={t}>
              <button
                type="button"
                disabled={pending}
                onClick={() => accept([t])}
                aria-label={`Add ${t} as a tag`}
                className="flex h-7 items-center gap-1 rounded-md border border-dashed border-pencil px-2 hover:border-ink hover:bg-paper disabled:opacity-50"
              >
                <span aria-hidden>+</span>
                {t}
              </button>
            </li>
          ),
        )}
      </ul>
      {error && (
        <p role="alert" className="mt-1.5 text-meta text-wrong">
          {error}
        </p>
      )}
    </div>
  );
}
