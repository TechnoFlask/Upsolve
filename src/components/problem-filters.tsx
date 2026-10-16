"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { PLATFORMS, SOLVED_DURING, STATUSES, type SolvedDuring } from "@/lib/constants";
import { formatDay, startOfDay, toDateInput } from "@/lib/dates";
import { PLATFORM_NAMES, STATUS_META } from "@/lib/difficulty";
import { addDays } from "@/lib/stats";

// Filters live in the URL, so they survive reloads and can be bookmarked.
export type Params = Record<string, string>;

export function useProblemFilters(params: Params) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (next: Params) => {
      const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v !== "")).toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname],
  );

  const update = (changes: Params) => navigate({ ...params, ...changes });
  const list = (key: string) => (params[key] ?? "").split(",").filter(Boolean);
  const toggle = (key: string, value: string) => {
    const current = list(key);
    update({ [key]: (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]).join(",") });
  };
  const clear = (keys: string[]) => update(Object.fromEntries(keys.map((k) => [k, ""])));
  const clearAll = () => navigate({ ...(params.sort && { sort: params.sort }), ...(params.dir && { dir: params.dir }) });

  return { params, pending, navigate, update, list, toggle, clear, clearAll };
}

export type Filters = ReturnType<typeof useProblemFilters>;

export const DURING_LABEL: Record<SolvedDuring, string> = {
  contest: "Live contest",
  virtual: "Virtual contest",
  practice: "Practice",
};

// --- Active filters, as removable chips

export type ActiveFilter = { id: string; label: string; keys: string[] };

function range(min?: string, max?: string): string {
  if (min && max) return min === max ? min : `${min}–${max}`;
  if (min) return `${min}+`;
  return `up to ${max}`;
}

const day = (d: string) => formatDay(startOfDay(d));

export function activeFilters(p: Params): ActiveFilter[] {
  const csv = (k: string) => (p[k] ?? "").split(",").filter(Boolean);
  const out: ActiveFilter[] = [];
  if (csv("platform").length) {
    out.push({ id: "platform", label: csv("platform").map((v) => PLATFORM_NAMES[v as keyof typeof PLATFORM_NAMES] ?? v).join(", "), keys: ["platform"] });
  }
  if (csv("status").length) {
    out.push({ id: "status", label: csv("status").map((v) => STATUS_META[v as keyof typeof STATUS_META]?.label ?? v).join(", "), keys: ["status"] });
  }
  if (p.editorial) out.push({ id: "editorial", label: p.editorial === "yes" ? "Used the editorial" : "Without the editorial", keys: ["editorial"] });
  if (p.minDifficulty || p.maxDifficulty) {
    out.push({ id: "difficulty", label: `Difficulty ${range(p.minDifficulty, p.maxDifficulty)}`, keys: ["minDifficulty", "maxDifficulty"] });
  }
  if (p.minTries || p.maxTries) {
    const first = p.maxTries === "1" && !p.minTries;
    out.push({ id: "tries", label: first ? "First try" : `Tries ${range(p.minTries, p.maxTries)}`, keys: ["minTries", "maxTries"] });
  }
  if (csv("tag").length) {
    const joiner = p.tagMode === "any" ? " or " : " and ";
    out.push({ id: "tag", label: csv("tag").join(joiner), keys: ["tag", "tagMode"] });
  }
  if (p.from || p.to) {
    const label = p.from && p.to ? `Solved ${day(p.from)} – ${day(p.to)}` : p.from ? `Solved since ${day(p.from)}` : `Solved until ${day(p.to)}`;
    out.push({ id: "solved", label, keys: ["from", "to"] });
  }
  if (csv("during").length) {
    out.push({ id: "during", label: `During: ${csv("during").map((v) => DURING_LABEL[v as SolvedDuring] ?? v).join(", ")}`, keys: ["during"] });
  }
  return out;
}

// --- One section per column. Each applies as you change it.

const checkboxRow = "flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-paper";
const checkbox = "size-4 accent-ink";

function CheckList(props: {
  f: Filters;
  paramKey: string;
  options: { value: string; label: string; color?: string }[];
}) {
  const selected = props.f.list(props.paramKey);
  return (
    <div className="flex flex-col">
      {props.options.map((o) => (
        <label key={o.value} className={checkboxRow}>
          <input type="checkbox" className={checkbox} checked={selected.includes(o.value)} onChange={() => props.f.toggle(props.paramKey, o.value)} />
          {o.color && <span aria-hidden className="size-2 rounded-full" style={{ background: o.color }} />}
          {o.label}
        </label>
      ))}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-meta text-pencil">{children}</p>;
}

function Presets(props: { options: { label: string; on: boolean; apply: () => void }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {props.options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={o.on}
          onClick={o.apply}
          className={`h-7 rounded-md border px-2 text-meta ${o.on ? "border-ink bg-ink text-white" : "border-rule bg-sheet hover:border-pencil"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumberInput(props: { value?: string; onCommit: (v: string) => void; label: string; placeholder: string }) {
  const [value, setValue] = useState(props.value ?? "");
  const commit = () => value !== (props.value ?? "") && props.onCommit(value);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      aria-label={props.label}
      placeholder={props.placeholder}
      className="tabular h-8 w-24 rounded-md border border-rule bg-sheet px-2 outline-none focus:border-ink"
    />
  );
}

function RangeInputs(props: { f: Filters; minKey: string; maxKey: string; noun: string; placeholders: [string, string] }) {
  const { params, update } = props.f;
  return (
    <div className="flex items-center gap-2">
      {/* Keyed by the URL value so presets and "clear" reset what's typed. */}
      <NumberInput key={`min-${params[props.minKey] ?? ""}`} value={params[props.minKey]} onCommit={(v) => update({ [props.minKey]: v })} label={`Minimum ${props.noun}`} placeholder={props.placeholders[0]} />
      <span className="text-pencil">to</span>
      <NumberInput key={`max-${params[props.maxKey] ?? ""}`} value={params[props.maxKey]} onCommit={(v) => update({ [props.maxKey]: v })} label={`Maximum ${props.noun}`} placeholder={props.placeholders[1]} />
    </div>
  );
}

export function PlatformFilter({ f }: { f: Filters }) {
  return <CheckList f={f} paramKey="platform" options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_NAMES[p] }))} />;
}

export function StatusFilter({ f }: { f: Filters }) {
  const editorial = f.params.editorial ?? "";
  return (
    <div className="flex flex-col gap-3">
      <CheckList f={f} paramKey="status" options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color }))} />
      <div>
        <SubHeading>Editorial</SubHeading>
        <Presets
          options={[
            { label: "Any", on: editorial === "", apply: () => f.update({ editorial: "" }) },
            { label: "Without it", on: editorial === "no", apply: () => f.update({ editorial: "no" }) },
            { label: "Used it", on: editorial === "yes", apply: () => f.update({ editorial: "yes" }) },
          ]}
        />
      </div>
    </div>
  );
}

export function DifficultyFilter({ f }: { f: Filters }) {
  return (
    <div className="flex flex-col gap-2">
      <RangeInputs f={f} minKey="minDifficulty" maxKey="maxDifficulty" noun="difficulty" placeholders={["800", "1600"]} />
      <p className="max-w-56 text-meta text-pencil">Codeforces rating or AtCoder estimate. LeetCode counts Easy as 1, Medium 2, Hard 3.</p>
    </div>
  );
}

export function TriesFilter({ f }: { f: Filters }) {
  const { minTries = "", maxTries = "" } = f.params;
  const preset = (min: string, max: string, label: string) => ({
    label,
    on: minTries === min && maxTries === max,
    apply: () => f.update(minTries === min && maxTries === max ? { minTries: "", maxTries: "" } : { minTries: min, maxTries: max }),
  });
  return (
    <div className="flex flex-col gap-3">
      <Presets options={[preset("", "1", "First try"), preset("2", "3", "2–3"), preset("4", "", "4 or more")]} />
      <RangeInputs f={f} minKey="minTries" maxKey="maxTries" noun="tries" placeholders={["1", "5"]} />
    </div>
  );
}

export function TagFilter({ f, allTags }: { f: Filters; allTags: string[] }) {
  const [search, setSearch] = useState("");
  const selected = f.list("tag");
  const shown = allTags.filter((t) => t.includes(search.trim().toLowerCase()));
  // Selected tags first, so they're easy to untick.
  const ordered = [...shown.filter((t) => selected.includes(t)), ...shown.filter((t) => !selected.includes(t))];
  const any = f.params.tagMode === "any";

  if (allTags.length === 0) return <p className="text-pencil">No tags yet. Codeforces sync adds them.</p>;
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Find a tag"
        aria-label="Find a tag"
        className="h-8 rounded-md border border-rule bg-sheet px-2 outline-none focus:border-ink"
      />
      <div className="max-h-56 overflow-y-auto">
        {ordered.map((t) => (
          <label key={t} className={checkboxRow}>
            <input type="checkbox" className={checkbox} checked={selected.includes(t)} onChange={() => f.toggle("tag", t)} />
            {t}
          </label>
        ))}
        {ordered.length === 0 && <p className="px-1.5 py-1 text-pencil">No tag matches “{search}”.</p>}
      </div>
      {selected.length > 1 && (
        <div>
          <SubHeading>Problems with</SubHeading>
          <Presets
            options={[
              { label: "All of these", on: !any, apply: () => f.update({ tagMode: "" }) },
              { label: "Any of these", on: any, apply: () => f.update({ tagMode: "any" }) },
            ]}
          />
        </div>
      )}
    </div>
  );
}

export function SolvedFilter({ f }: { f: Filters }) {
  const { from = "", to = "" } = f.params;
  const today = toDateInput(new Date());
  const since = (start: string, label: string) => ({
    label,
    on: from === start && to === "",
    apply: () => f.update(from === start && to === "" ? { from: "", to: "" } : { from: start, to: "" }),
  });
  return (
    <div className="flex flex-col gap-3">
      <Presets options={[since(addDays(today, -6), "Last 7 days"), since(addDays(today, -29), "Last 30 days"), since(`${today.slice(0, 4)}-01-01`, "This year")]} />
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={from} max={to || undefined} onChange={(e) => f.update({ from: e.target.value })} aria-label="Solved from" className="h-8 rounded-md border border-rule bg-sheet px-2" />
        <span className="text-pencil">to</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => f.update({ to: e.target.value })} aria-label="Solved to" className="h-8 rounded-md border border-rule bg-sheet px-2" />
      </div>
      <div>
        <SubHeading>Solved during</SubHeading>
        <CheckList f={f} paramKey="during" options={SOLVED_DURING.map((d) => ({ value: d, label: DURING_LABEL[d] }))} />
      </div>
    </div>
  );
}

// --- Column header popover

function FunnelIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="shrink-0">
      <path
        d="M2 3h12l-4.5 5.5V13l-3 1.5v-6Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A filter button for a table column, opening a popover in the top layer so the
 * table's rounded, clipped container doesn't cut it off. Escape and clicking
 * outside close it.
 */
export function ColumnFilter(props: { label: string; active: boolean; align?: "start" | "end"; children: React.ReactNode }) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const popover = popoverRef.current;
    const button = buttonRef.current;
    if (!popover || !button) return;
    const b = button.getBoundingClientRect();
    const width = popover.offsetWidth;
    const preferred = props.align === "end" ? b.right - width : b.left - 8;
    popover.style.left = `${Math.min(Math.max(8, preferred), window.innerWidth - width - 8)}px`;
    popover.style.top = `${b.bottom + 6}px`;
  }, [props.align]);

  // Applying a filter can move the header (the chips row appears); follow it.
  useLayoutEffect(() => {
    if (popoverRef.current?.matches(":popover-open")) place();
  });

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") {
        place();
        // Keyboard users land on the first control (the tag search, a checkbox…).
        popover.querySelector<HTMLElement>("input, button, select")?.focus();
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
      } else {
        window.removeEventListener("scroll", place, true);
        window.removeEventListener("resize", place);
      }
    };
    popover.addEventListener("toggle", onToggle);
    return () => {
      popover.removeEventListener("toggle", onToggle);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [place]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={id}
        aria-label={`Filter by ${props.label.toLowerCase()}${props.active ? " (on)" : ""}`}
        title={`Filter by ${props.label.toLowerCase()}`}
        className={`grid size-6 place-items-center rounded hover:bg-paper ${props.active ? "text-ink" : "text-pencil/70 hover:text-ink"}`}
      >
        <FunnelIcon active={props.active} />
      </button>
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        aria-label={`Filter by ${props.label.toLowerCase()}`}
        className="fixed inset-auto m-0 min-w-56 rounded-lg border border-rule bg-sheet p-3 text-left text-body font-normal text-ink shadow-[0_10px_30px_rgb(27_36_48/0.16)]"
      >
        <p className="mb-2 font-semibold">{props.label}</p>
        {props.children}
      </div>
    </>
  );
}
