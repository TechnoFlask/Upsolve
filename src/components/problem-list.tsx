"use client";

import Link from "next/link";
import { useState } from "react";
import type { Problem } from "@/db/schema";
import { formatDay } from "@/lib/dates";
import { PLATFORM_NAMES, STATUS_META, difficultyText, tierColor } from "@/lib/difficulty";
import { FilterBar } from "./filter-bar";
import { OpenLink } from "./open-link";
import {
  ColumnFilter,
  DifficultyFilter,
  PlatformFilter,
  SolvedFilter,
  StatusFilter,
  TagFilter,
  TriesFilter,
  useProblemFilters,
} from "./problem-filters";
import { ProblemDialog } from "./problem-dialog";

type SortField = "solvedAt" | "difficulty" | "name" | "platform" | "tries" | "updatedAt";

type Props = {
  problems: Problem[];
  allTags: string[];
  summary: string;
  isEmpty: boolean;
  filtered: boolean;
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
          <FilterBar params={props.params} allTags={props.allTags} />
          <div className="mt-4 overflow-hidden rounded-lg border border-rule bg-sheet">
            {/* The table keeps its header when nothing matches, so filters can be undone there. */}
            <DesktopTable {...props} onOpen={setEditing} />
            <MobileList problems={props.problems} onOpen={setEditing} />
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

const NO_MATCH = "No problems match these filters.";

/** A column header: its label (a sort link where sortable) and, optionally, its filter. */
function Header(props: {
  label: string;
  field?: SortField;
  sort: Props["sort"];
  params: Props["params"];
  align?: "right";
  filter?: { active: boolean; content: React.ReactNode };
}) {
  const active = props.field && props.sort.field === props.field;
  const nextDir = active && props.sort.dir === "desc" ? "asc" : "desc";
  const qs = new URLSearchParams({ ...props.params, sort: props.field ?? "", dir: nextDir });
  const labelClass = active || props.filter?.active ? "text-ink" : "hover:text-ink";
  return (
    <th
      scope="col"
      aria-sort={active ? (props.sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className="px-4 py-2 font-normal"
    >
      <div className={`flex items-center gap-1 ${props.align === "right" ? "justify-end" : ""}`}>
        {props.field ? (
          <Link href={`?${qs}`} scroll={false} replace className={labelClass}>
            {props.label}
            {active && <span aria-hidden>{props.sort.dir === "asc" ? " ↑" : " ↓"}</span>}
          </Link>
        ) : (
          <span className={props.filter?.active ? "text-ink" : ""}>{props.label}</span>
        )}
        {props.filter && (
          <ColumnFilter label={props.label} active={props.filter.active} align={props.align === "right" ? "end" : "start"}>
            {props.filter.content}
          </ColumnFilter>
        )}
      </div>
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
  const f = useProblemFilters(params);
  const has = (...keys: string[]) => keys.some((k) => Boolean(params[k]));
  const header = { sort, params };
  return (
    <table className="hidden w-full text-left md:table">
      <thead className="border-b border-rule text-meta text-pencil">
        <tr>
          <Header {...header} label="Problem" field="name" />
          <Header {...header} label="Platform" field="platform" filter={{ active: has("platform"), content: <PlatformFilter f={f} /> }} />
          <Header {...header} label="Difficulty" field="difficulty" align="right" filter={{ active: has("minDifficulty", "maxDifficulty"), content: <DifficultyFilter f={f} /> }} />
          <Header {...header} label="Status" filter={{ active: has("status", "editorial"), content: <StatusFilter f={f} /> }} />
          <Header {...header} label="Tries" field="tries" align="right" filter={{ active: has("minTries", "maxTries"), content: <TriesFilter f={f} /> }} />
          <Header {...header} label="Tags" filter={{ active: has("tag"), content: <TagFilter f={f} allTags={props.allTags} /> }} />
          <Header {...header} label="Solved" field="solvedAt" align="right" filter={{ active: has("from", "to", "during"), content: <SolvedFilter f={f} /> }} />
        </tr>
      </thead>
      <tbody className="divide-y divide-rule">
        {props.problems.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-10 text-center text-pencil">
              {NO_MATCH}
            </td>
          </tr>
        )}
        {props.problems.map((p) => (
          <tr key={p.id} className="align-top hover:bg-paper/60">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <ProblemName p={p} onOpen={props.onOpen} />
                <OpenLink url={p.url} name={p.name} />
              </div>
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              <div>{PLATFORM_NAMES[p.platform]}</div>
              <div className="tabular text-meta text-pencil">{p.externalId}</div>
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
      {problems.length === 0 && <li className="px-4 py-10 text-center text-pencil">{NO_MATCH}</li>}
      {problems.map((p) => (
        <li key={p.id} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <ProblemName p={p} onOpen={onOpen} />
            <span className="tabular shrink-0">
              {difficultyText(p.platform, p.difficulty, p.difficultyLabel)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-pencil">
            <span>
              <span className="font-medium text-ink">{PLATFORM_NAMES[p.platform]}</span>{" "}
              <span className="tabular">{p.externalId}</span>
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
