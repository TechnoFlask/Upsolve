import Link from "next/link";
import type { TagStat } from "@/lib/stats";

/** Solved vs. not-yet-solved per tag; weak topics are called out. */
export function TagTable({ stats }: { stats: TagStat[] }) {
  const max = Math.max(...stats.map((s) => s.solved + s.unsolved), 1);
  return (
    <ul className="divide-y divide-rule">
      {stats.map((s) => {
        const total = s.solved + s.unsolved;
        return (
          <li
            key={s.tag}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-2 sm:grid-cols-[minmax(7rem,12rem)_1fr_15rem]"
          >
            <Link href={`/?tag=${encodeURIComponent(s.tag)}`} className="truncate underline-offset-4 hover:underline">
              {s.tag}
            </Link>
            <div className="col-span-2 row-start-2 flex h-2.5 overflow-hidden rounded-full bg-paper sm:col-span-1 sm:row-start-1 sm:col-start-2" aria-hidden>
              <span className="bg-accepted" style={{ width: `${(s.solved / max) * 100}%` }} />
              <span className="bg-wrong/60" style={{ width: `${(s.unsolved / max) * 100}%` }} />
            </div>
            <div className="flex items-center justify-end gap-3 text-meta tabular sm:col-start-3 sm:row-start-1">
              <span>
                {s.solved}/{total} solved
              </span>
              {s.editorial > 0 && <span className="text-pencil">{s.editorial} with editorial</span>}
              {s.weak && <span className="font-medium text-amber">Weak spot</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
