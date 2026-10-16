"use client";

import { useEffect, useState } from "react";
import {
  activeFilters,
  DifficultyFilter,
  PlatformFilter,
  SolvedFilter,
  StatusFilter,
  TagFilter,
  TriesFilter,
  useProblemFilters,
  type Params,
} from "./problem-filters";

const SORT_OPTIONS = [
  { value: "solvedAt", label: "Date solved" },
  { value: "difficulty", label: "Difficulty" },
  { value: "name", label: "Name" },
  { value: "platform", label: "Platform" },
  { value: "tries", label: "Tries" },
  { value: "updatedAt", label: "Last edited" },
];

/**
 * Search and the filters in effect. On wide screens each column's filter sits in
 * its header; on phones (no headers) the Filters panel holds them all.
 */
export function FilterBar({ params, allTags }: { params: Params; allTags: string[] }) {
  const f = useProblemFilters(params);
  const [query, setQuery] = useState(params.q ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const active = activeFilters(params);

  // Debounce typing into the search box.
  useEffect(() => {
    if (query === (params.q ?? "")) return;
    const t = setTimeout(() => f.update({ q: query.trim() }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filtering = active.length > 0 || Boolean(params.q);

  return (
    <div className="flex flex-col gap-3" aria-busy={f.pending}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names, IDs and notes"
          aria-label="Search problems"
          className="h-9 min-w-0 flex-1 rounded-md border border-rule bg-sheet px-3 outline-none focus:border-ink sm:max-w-80"
        />
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="problem-filter-panel"
          className={`h-9 rounded-md border px-3 text-meta md:hidden ${panelOpen ? "border-ink" : "border-rule"} bg-sheet`}
        >
          Filters{active.length ? ` (${active.length})` : ""}
        </button>
        <p className="hidden text-meta text-pencil md:block">Filter any column from its header.</p>
      </div>

      {panelOpen && (
        <div id="problem-filter-panel" className="grid gap-5 rounded-lg border border-rule bg-sheet p-4 md:hidden">
          <PanelSection title="Platform"><PlatformFilter f={f} /></PanelSection>
          <PanelSection title="Status"><StatusFilter f={f} /></PanelSection>
          <PanelSection title="Difficulty"><DifficultyFilter f={f} /></PanelSection>
          <PanelSection title="Tries"><TriesFilter f={f} /></PanelSection>
          <PanelSection title="Tags"><TagFilter f={f} allTags={allTags} /></PanelSection>
          <PanelSection title="Solved"><SolvedFilter f={f} /></PanelSection>
          <PanelSection title="Sort by">
            <div className="flex items-center gap-2 text-meta">
              <select value={params.sort ?? "solvedAt"} onChange={(e) => f.update({ sort: e.target.value })} aria-label="Sort by" className="h-8 rounded-md border border-rule bg-sheet px-2">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select value={params.dir ?? "desc"} onChange={(e) => f.update({ dir: e.target.value })} aria-label="Sort direction" className="h-8 rounded-md border border-rule bg-sheet px-2">
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </PanelSection>
          <button type="button" onClick={() => setPanelOpen(false)} className="h-10 rounded-md bg-ink font-medium text-white">
            Done
          </button>
        </div>
      )}

      {filtering && (
        <div className="flex flex-wrap items-center gap-1.5 text-meta">
          {active.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => f.clear(a.keys)}
              aria-label={`Remove filter: ${a.label}`}
              className="flex h-7 items-center gap-1.5 rounded-md border border-ink bg-sheet px-2 hover:bg-paper"
            >
              {a.label}
              <span aria-hidden className="text-pencil">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              f.clearAll();
            }}
            className="ml-1 text-pencil underline-offset-4 hover:text-ink hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 font-semibold">{title}</h3>
      {children}
    </section>
  );
}
