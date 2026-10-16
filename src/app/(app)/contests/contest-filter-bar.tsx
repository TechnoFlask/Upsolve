"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

type Params = Record<string, string>;

const TYPES = [
  { value: "live", label: "Live" },
  { value: "virtual", label: "Virtual" },
  { value: "practice", label: "Practice only" },
];

export function ContestFilterBar({ params }: { params: Params }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function navigate(next: Params) {
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v !== "")).toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const types = (params.type ?? "").split(",").filter(Boolean);
  const toggleType = (v: string) =>
    navigate({ ...params, type: (types.includes(v) ? types.filter((t) => t !== v) : [...types, v]).join(",") });
  const leftOnly = params.left === "1";

  const chip = (on: boolean) =>
    `flex h-8 items-center rounded-md border px-2.5 ${on ? "border-ink bg-ink text-white" : "border-rule bg-sheet text-ink hover:border-pencil"}`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-meta" aria-busy={pending}>
      <div role="group" aria-label="How you took part" className="flex flex-wrap gap-1">
        {TYPES.map((t) => (
          <button key={t.value} type="button" aria-pressed={types.includes(t.value)} onClick={() => toggleType(t.value)} className={chip(types.includes(t.value))}>
            {t.label}
          </button>
        ))}
      </div>
      <button type="button" aria-pressed={leftOnly} onClick={() => navigate({ ...params, left: leftOnly ? "" : "1" })} className={chip(leftOnly)}>
        Problems left to upsolve
      </button>
    </div>
  );
}
