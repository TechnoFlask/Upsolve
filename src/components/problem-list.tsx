"use client";

import Link from "next/link";
import { useState } from "react";
import type { Problem } from "@/db/schema";
import { formatDay } from "@/lib/dates";
import { PLATFORM_NAMES, STATUS_META, difficultyText, tierColor } from "@/lib/difficulty";
import { OpenLink } from "./open-link";
import { ProblemDialog } from "./problem-dialog";

type SortField = "solvedAt" | "difficulty" | "name" | "tries" | "updatedAt";

type Props = {
  problems: Problem[];
  allTags: string[];
  summary: string;
  isEmpty: boolean;
  filtered: boolean;
  filterBar: React.ReactNode;
  sort: { field: SortField; dir: "asc" | "desc" };
  params: Record<string, string>;
};


export function ProblemList(props: Props) {
  // null = closed, "new" = add form, Problem = edit form
  const [editing, setEditing] = useState<Problem | "new" | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Problems</h1>
          <p className="mt-1 text-pencil">{props.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="h-10 rounded-md bg-accepted px-4 font-medium text-white hover:bg-accepted-dark"
        >
          Add problem
        </button>
      </div>

      {props.isEmpty ? (
        <EmptyState onAdd={() => setEditing("new")} />
      ) : (
        <>
          {props.filterBar}
          <div className="mt-4 overflow-hidden rounded-lg border border-rule bg-sheet">
            {props.problems.length === 0 ? (
              <p className="px-4 py-10 text-center text-pencil">
                No problems match these filters.
              </p>
            ) : (
              <>
                <DesktopTable {...props} onOpen={setEditing} />
                <MobileList problems={props.problems} onOpen={setEditing} />
              </>
            )}
          </div>
          {props.filtered && props.problems.length > 0 && (
            <p className="mt-3 text-meta text-pencil">
              Showing {props.problems.length} {props.problems.length === 1 ? "problem" : "problems"}.
            </p>
          )}
        </>
      )}

      <ProblemDialog
        problem={editing}
        allTags={props.allTags}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-rule bg-sheet px-6 py-14 text-center">
      <p className="font-medium">Nothing tracked yet.</p>
      <p className="mx-auto mt-1 max-w-md text-pencil">
        Add the last problem you solved. Paste its link and the platform and ID fill in for you.
      </p>
      <button type="button" onClick={onAdd} className="mt-5 h-10 rounded-md border border-ink px-4 font-medium hover:bg-paper">
        Add your first problem
      </button>
    </div>
  );
}

function SortHeader(props: {
  field: SortField;
  label: string;
  sort: Props["sort"];
  params: Props["params"];
  className?: string;
}) {
  const active = props.sort.field === props.field;
  const nextDir = active && props.sort.dir === "desc" ? "asc" : "desc";
  const qs = new URLSearchParams({ ...props.params, sort: props.field, dir: nextDir });
  return (
    <th
      scope="col"
      aria-sort={active ? (props.sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`px-4 py-2.5 font-normal ${props.className ?? ""}`}
    >
      <Link href={`?${qs}`} scroll={false} replace className={active ? "text-ink" : "hover:text-ink"}>
        {props.label}
        {active && <span aria-hidden>{props.sort.dir === "asc" ? " ↑" : " ↓"}</span>}
      </Link>
    </th>
  );
}

function ProblemName({ p, onOpen }: { p: Problem; onOpen: (p: Problem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(p)}
      className="text-left font-semibold hover:underline underline-offset-4"
      style={{ color: tierColor(p.platform, p.difficulty) }}
    >
      {p.name}
    </button>
  );
}

function StatusText({ p }: { p: Problem }) {
  const meta = STATUS_META[p.status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className="size-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

function DesktopTable(props: Props & { onOpen: (p: Problem) => void }) {
  const { sort, params } = props;
  return (
    <table className="hidden w-full text-left md:table">
      <thead className="border-b border-rule text-meta text-pencil">
        <tr>
          <SortHeader field="name" label="Problem" sort={sort} params={params} />
          <SortHeader field="difficulty" label="Difficulty" sort={sort} params={params} className="text-right" />
          <th scope="col" className="px-4 py-2.5 font-normal">Status</th>
          <SortHeader field="tries" label="Tries" sort={sort} params={params} className="text-right" />
          <th scope="col" className="px-4 py-2.5 font-normal">Tags</th>
          <SortHeader field="solvedAt" label="Solved" sort={sort} params={params} className="text-right" />
        </tr>
      </thead>
      <tbody className="divide-y divide-rule">
        {props.problems.map((p) => (
          <tr key={p.id} className="align-top hover:bg-paper/60">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <ProblemName p={p} onOpen={props.onOpen} />
                <OpenLink url={p.url} name={p.name} />
              </div>
              <div className="tabular text-meta text-pencil">
                {PLATFORM_NAMES[p.platform]} {p.externalId}
              </div>
            </td>
            <td className="tabular px-4 py-3 text-right">
              {difficultyText(p.platform, p.difficulty, p.difficultyLabel)}
            </td>
            <td className="px-4 py-3">
              <StatusText p={p} />
              {p.usedEditorial && <div className="text-meta text-pencil">Used editorial</div>}
            </td>
            <td className="tabular px-4 py-3 text-right">{p.tries}</td>
            <td className="max-w-56 px-4 py-3 text-meta text-pencil">{p.tags.join(", ")}</td>
            <td className="tabular whitespace-nowrap px-4 py-3 text-right text-pencil">
              {p.solvedAt ? formatDay(p.solvedAt) : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MobileList({ problems, onOpen }: { problems: Problem[]; onOpen: (p: Problem) => void }) {
  return (
    <ul className="divide-y divide-rule md:hidden">
      {problems.map((p) => (
        <li key={p.id} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <ProblemName p={p} onOpen={onOpen} />
            <span className="tabular shrink-0">
              {difficultyText(p.platform, p.difficulty, p.difficultyLabel)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-pencil">
            <span className="tabular">
              {PLATFORM_NAMES[p.platform]} {p.externalId}
            </span>
            <span className="text-ink">
              <StatusText p={p} />
            </span>
            {p.tries > 1 && <span className="tabular">{p.tries} tries</span>}
            {p.usedEditorial && <span>Used editorial</span>}
            {p.solvedAt && <span className="tabular">{formatDay(p.solvedAt)}</span>}
            <OpenLink url={p.url} name={p.name} />
          </div>
        </li>
      ))}
    </ul>
  );
}
