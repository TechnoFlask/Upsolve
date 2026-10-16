"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createProblem,
  deleteProblem,
  updateProblem,
  type ProblemFormState,
} from "@/app/problems/actions";
import type { Problem } from "@/db/schema";
import { PLATFORMS, STATUSES, type Platform } from "@/lib/constants";
import { toDateInput } from "@/lib/dates";
import { LEETCODE_LEVELS, PLATFORM_NAMES, STATUS_META } from "@/lib/difficulty";
import { parseProblemUrl } from "@/lib/parse-problem-url";
import { SolutionPanel } from "./solution-panel";

type Props = {
  problem: Problem | "new" | null;
  allTags: string[];
  onClose: () => void;
};

export function ProblemDialog({ problem, allTags, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Remount the form each time the dialog opens so "new" always starts blank.
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (problem && !dialog.open) {
      setOpenCount((n) => n + 1);
      dialog.showModal();
    } else if (!problem && dialog.open) {
      dialog.close();
    }
  }, [problem]);

  return (
    <dialog
      ref={ref}
      className="panel"
      aria-labelledby="problem-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {problem && (
        <ProblemForm
          key={`${problem === "new" ? "new" : problem.id}-${openCount}`}
          problem={problem === "new" ? null : problem}
          allTags={allTags}
          onDone={onClose}
        />
      )}
    </dialog>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-rule bg-sheet px-3 outline-none focus:border-ink aria-invalid:border-wrong";


function ProblemForm({
  problem,
  allTags,
  onDone,
}: {
  problem: Problem | null;
  allTags: string[];
  onDone: () => void;
}) {
  const action = problem ? updateProblem.bind(null, problem.id) : createProblem;
  const [state, formAction, saving] = useActionState<ProblemFormState, FormData>(action, {});
  const [deleting, startDelete] = useTransition();

  const [url, setUrl] = useState(problem?.url ?? "");
  const [platform, setPlatform] = useState<Platform>(problem?.platform ?? "codeforces");
  const [externalId, setExternalId] = useState(problem?.externalId ?? "");
  const [name, setName] = useState(problem?.name ?? "");
  const [urlHint, setUrlHint] = useState<string | null>(null);
  // Controlled, so tags accepted from the solution analysis show up here and
  // aren't wiped when you save the form.
  const [tags, setTags] = useState(problem?.tags.join(", ") ?? "");
  const tagList = splitTags(tags);
  const acceptTags = (added: string[]) => setTags((current) => [...new Set([...splitTags(current), ...added])].join(", "));

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  function onUrlChange(value: string) {
    setUrl(value);
    const parsed = parseProblemUrl(value);
    if (!parsed) {
      setUrlHint(null);
      return;
    }
    setPlatform(parsed.platform);
    setExternalId(parsed.externalId);
    if (parsed.name && !name) setName(parsed.name);
    setUrlHint(`Recognised ${PLATFORM_NAMES[parsed.platform]} problem ${parsed.externalId}.`);
  }

  function onDelete() {
    if (!problem) return;
    if (!confirm(`Delete “${problem.name}”? Your notes for it will be lost.`)) return;
    startDelete(async () => {
      await deleteProblem(problem.id);
      onDone();
    });
  }

  const err = (field: keyof NonNullable<ProblemFormState["fieldErrors"]>) =>
    state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-rule px-6 py-4">
        <h2 id="problem-dialog-title" className="text-lg font-semibold">
          {problem ? "Edit problem" : "Add problem"}
        </h2>
        <button type="button" onClick={onDone} className="text-meta text-pencil hover:text-ink">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {problem && <SolutionPanel problem={problem} tags={tagList} onTagsAccepted={acceptTags} />}
        <Field label="Link" hint={urlHint ?? "Paste a Codeforces, LeetCode or AtCoder link to fill in the details."} error={err("url")}>
          {(id, describedBy) => (
            <input
              id={id}
              name="url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://codeforces.com/problemset/problem/1950/C"
              aria-describedby={describedBy}
              aria-invalid={Boolean(err("url"))}
              className={inputClass}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Platform">
            {(id) => (
              <select id={id} name="platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={inputClass}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_NAMES[p]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Problem ID" error={err("externalId")}>
            {(id, describedBy) => (
              <input
                id={id}
                name="externalId"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder={platform === "leetcode" ? "two-sum" : platform === "atcoder" ? "abc350_e" : "1950C"}
                required
                aria-describedby={describedBy}
                aria-invalid={Boolean(err("externalId"))}
                className={`tabular ${inputClass}`}
              />
            )}
          </Field>
        </div>

        <Field label="Name" error={err("name")}>
          {(id, describedBy) => (
            <input
              id={id}
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-describedby={describedBy}
              aria-invalid={Boolean(err("name"))}
              className={inputClass}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Difficulty" hint={platform === "codeforces" ? "Problem rating" : platform === "atcoder" ? "Estimated difficulty" : undefined} error={err("difficulty")}>
            {(id, describedBy) =>
              platform === "leetcode" ? (
                <select id={id} name="difficulty" defaultValue={problem?.difficulty ?? ""} className={inputClass}>
                  <option value="">Not set</option>
                  {LEETCODE_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  name="difficulty"
                  type="number"
                  inputMode="numeric"
                  defaultValue={problem?.difficulty ?? ""}
                  placeholder="1600"
                  aria-describedby={describedBy}
                  className={`tabular ${inputClass}`}
                />
              )
            }
          </Field>
          <Field label="Solved on" error={err("solvedAt")}>
            {(id) => (
              <input
                id={id}
                name="solvedAt"
                type="date"
                defaultValue={problem ? (problem.solvedAt ? toDateInput(problem.solvedAt) : "") : toDateInput(new Date())}
                className={`tabular ${inputClass}`}
              />
            )}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-meta text-pencil">Status</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUSES.map((s) => (
              <label
                key={s}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-rule px-3 has-checked:border-ink has-focus-visible:outline-2 has-focus-visible:outline-revisit"
              >
                <input type="radio" name="status" value={s} defaultChecked={(problem?.status ?? "solved") === s} className="sr-only" />
                <span aria-hidden className="size-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                {STATUS_META[s].label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 items-end gap-4">
          <Field label="Tries" error={err("tries")}>
            {(id) => (
              <input id={id} name="tries" type="number" inputMode="numeric" min={0} defaultValue={problem?.tries ?? 1} className={`tabular ${inputClass}`} />
            )}
          </Field>
          <label className="flex h-10 items-center gap-2">
            <input type="checkbox" name="usedEditorial" defaultChecked={problem?.usedEditorial ?? false} className="size-4 accent-ink" />
            Used the editorial
          </label>
        </div>

        <Field label="Tags" hint="Separate with commas.">
          {(id, describedBy) => (
            <>
              <input
                id={id}
                name="tags"
                list="known-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="greedy, binary search"
                aria-describedby={describedBy}
                className={inputClass}
              />
              <datalist id="known-tags">
                {allTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </>
          )}
        </Field>

        <Field label="Notes" hint="The key idea, and anything that tripped you up.">
          {(id, describedBy) => (
            <textarea
              id={id}
              name="notes"
              rows={6}
              defaultValue={problem?.notes ?? ""}
              aria-describedby={describedBy}
              className="w-full rounded-md border border-rule bg-sheet px-3 py-2 leading-relaxed outline-none focus:border-ink"
            />
          )}
        </Field>
      </div>

      <div className="flex items-center gap-3 border-t border-rule px-6 py-4">
        {state.error && (
          <p role="alert" className="mr-auto text-meta text-wrong">
            {state.error}
          </p>
        )}
        {problem && !state.error && (
          <button type="button" onClick={onDelete} disabled={deleting} className="mr-auto text-meta text-wrong hover:underline underline-offset-4 disabled:opacity-60">
            {deleting ? "Deleting…" : "Delete problem"}
          </button>
        )}
        <button
          type="submit"
          disabled={saving || deleting}
          className="ml-auto h-10 rounded-md bg-accepted px-4 font-medium text-white hover:bg-accepted-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : problem ? "Save changes" : "Add problem"}
        </button>
      </div>
    </form>
  );
}

function Field(props: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}) {
  const id = `f-${props.label.toLowerCase().replace(/\W+/g, "-")}`;
  const noteId = `${id}-note`;
  const note = props.error ?? props.hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-meta text-pencil">
        {props.label}
      </label>
      {props.children(id, note ? noteId : undefined)}
      {note && (
        <p id={noteId} className={`text-meta ${props.error ? "text-wrong" : "text-pencil"}`}>
          {note}
        </p>
      )}
    </div>
  );
}

const splitTags = (value: string) => value.split(",").map((t) => t.trim()).filter(Boolean);
