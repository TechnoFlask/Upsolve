"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PLATFORMS, STATUSES } from "@/lib/constants";
import { PLATFORM_NAMES, STATUS_META } from "@/lib/difficulty";

type Params = Record<string, string>;

const SORT_OPTIONS = [
  { value: "solvedAt", label: "Date solved" },
  { value: "difficulty", label: "Difficulty" },
  { value: "name", label: "Name" },
  { value: "tries", label: "Tries" },
  { value: "updatedAt", label: "Last edited" },
];

const ADVANCED_KEYS = ["tag", "minDifficulty", "maxDifficulty", "from", "to", "editorial"];

export function FilterBar({ params, allTags }: { params: Params; allTags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.q ?? "");
  const [showMore, setShowMore] = useState(() => ADVANCED_KEYS.some((k) => params[k]));

  function navigate(next: Params) {
    const qs = new URLSearchParams(
      Object.entries(next).filter(([, v]) => v !== ""),
    ).toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function set(key: string, value: string) {
    navigate({ ...params, [key]: value });
  }

  function toggle(key: string, value: string) {
    const current = (params[key] ?? "").split(",").filter(Boolean);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    set(key, next.join(","));
  }

  // Debounce typing into the search box.
  useEffect(() => {
    if (query === (params.q ?? "")) return;
    const t = setTimeout(() => set("q", query.trim()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selected = (key: string) => (params[key] ?? "").split(",").filter(Boolean);
  const tags = selected("tag");
  const hasFilters = Object.keys(params).some((k) => k !== "sort" && k !== "dir");

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names, IDs and notes"
          aria-label="Search problems"
          className="h-9 w-full rounded-md border border-rule bg-sheet px-3 outline-none focus:border-ink sm:w-72"
        />
        <ToggleGroup
          label="Platform"
          options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_NAMES[p] }))}
          selected={selected("platform")}
          onToggle={(v) => toggle("platform", v)}
        />
        <ToggleGroup
          label="Status"
          options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color }))}
          selected={selected("status")}
          onToggle={(v) => toggle("status", v)}
        />
        <div className="flex items-center gap-4 text-meta">
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            aria-expanded={showMore}
            className="text-pencil underline-offset-4 hover:text-ink hover:underline"
          >
            {showMore ? "Fewer filters" : "More filters"}
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                navigate({ ...(params.sort && { sort: params.sort }), ...(params.dir && { dir: params.dir }) });
              }}
              className="text-pencil underline-offset-4 hover:text-ink hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {showMore && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 text-meta">
          <Field label="Tags">
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle("tag", t)}
                  aria-label={`Remove tag filter ${t}`}
                  className="h-8 rounded-md border border-ink px-2"
                >
                  {t} <span aria-hidden>×</span>
                </button>
              ))}
              <select
                value=""
                onChange={(e) => e.target.value && toggle("tag", e.target.value)}
                aria-label="Add tag filter"
                className="h-8 rounded-md border border-rule bg-sheet px-2"
              >
                <option value="">{allTags.length ? "Add tag" : "No tags yet"}</option>
                {allTags
                  .filter((t) => !tags.includes(t))
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
            </div>
          </Field>
          <Field label="Difficulty">
            <div className="flex items-center gap-2">
              <NumberFilter key={`min-${params.minDifficulty ?? ""}`} value={params.minDifficulty} onCommit={(v) => set("minDifficulty", v)} label="Minimum difficulty" placeholder="800" />
              <span className="text-pencil">to</span>
              <NumberFilter key={`max-${params.maxDifficulty ?? ""}`} value={params.maxDifficulty} onCommit={(v) => set("maxDifficulty", v)} label="Maximum difficulty" placeholder="1600" />
            </div>
          </Field>
          <Field label="Solved between">
            <div className="flex items-center gap-2">
              <input type="date" value={params.from ?? ""} onChange={(e) => set("from", e.target.value)} aria-label="Solved from" className="h-8 rounded-md border border-rule bg-sheet px-2" />
              <span className="text-pencil">and</span>
              <input type="date" value={params.to ?? ""} onChange={(e) => set("to", e.target.value)} aria-label="Solved to" className="h-8 rounded-md border border-rule bg-sheet px-2" />
            </div>
          </Field>
          <Field label="Editorial">
            <select value={params.editorial ?? ""} onChange={(e) => set("editorial", e.target.value)} className="h-8 rounded-md border border-rule bg-sheet px-2">
              <option value="">Any</option>
              <option value="no">Solved without it</option>
              <option value="yes">Used it</option>
            </select>
          </Field>
          <Field label="Sort by">
            <div className="flex items-center gap-2">
              <select value={params.sort ?? "solvedAt"} onChange={(e) => set("sort", e.target.value)} className="h-8 rounded-md border border-rule bg-sheet px-2">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select value={params.dir ?? "desc"} onChange={(e) => set("dir", e.target.value)} aria-label="Sort direction" className="h-8 rounded-md border border-rule bg-sheet px-2">
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-pencil">{label}</span>
      {children}
    </div>
  );
}

function NumberFilter(props: { value?: string; onCommit: (v: string) => void; label: string; placeholder: string }) {
  const [value, setValue] = useState(props.value ?? "");
  const commit = () => value !== (props.value ?? "") && props.onCommit(value);
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      aria-label={props.label}
      placeholder={props.placeholder}
      className="tabular h-8 w-20 rounded-md border border-rule bg-sheet px-2"
    />
  );
}

function ToggleGroup(props: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={props.label} className="flex flex-wrap items-center gap-1 text-meta">
      {props.options.map((o) => {
        const on = props.selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => props.onToggle(o.value)}
            className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 ${
              on ? "border-ink bg-ink text-white" : "border-rule bg-sheet text-ink hover:border-pencil"
            }`}
          >
            {o.color && <span aria-hidden className="size-2 rounded-full" style={{ background: o.color }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
