import type { HeatmapCell } from "@/lib/stats";

const CELL = 11;
const STEP = 14;
const LEFT = 28;
const TOP = 16;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Accepted-green ramp; empty days use the rule colour.
function fill(count: number): string {
  if (count === 0) return "#e3e8ee";
  if (count === 1) return "#b5dfc2";
  if (count === 2) return "#71c08c";
  if (count <= 4) return "#2f9a56";
  return "#16803c";
}

export function Heatmap({ weeks }: { weeks: HeatmapCell[][] }) {
  const width = LEFT + weeks.length * STEP;
  const height = TOP + 7 * STEP;
  const monthLabels = weeks.flatMap((week, i) => {
    const month = Number(week[0].day.slice(5, 7)) - 1;
    const prev = i > 0 ? Number(weeks[i - 1][0].day.slice(5, 7)) - 1 : -1;
    return month !== prev && i < weeks.length - 2 ? [{ x: LEFT + i * STEP, label: MONTHS[month] }] : [];
  });

  return (
    // Scrolls sideways on phones; the newest weeks are on the right.
    <div className="overflow-x-auto" dir="rtl">
      <svg
        direction="ltr"
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", minWidth: width }}
        role="img"
        aria-label="Problems solved per day over the last year"
        className="block text-[9px]"
      >
        {monthLabels.map((m) => (
          <text key={m.x} x={m.x} y={10} className="fill-pencil">
            {m.label}
          </text>
        ))}
        {["Mon", "Wed", "Fri"].map((d, i) => (
          <text key={d} x={0} y={TOP + (i * 2) * STEP + 9} className="fill-pencil">
            {d}
          </text>
        ))}
        {weeks.map((week, w) =>
          week.map((cell, d) =>
            cell.future ? null : (
              <rect key={cell.day} x={LEFT + w * STEP} y={TOP + d * STEP} width={CELL} height={CELL} rx={2} fill={fill(cell.count)}>
                <title>{`${cell.day}: ${cell.count === 0 ? "no solves" : `${cell.count} solved`}`}</title>
              </rect>
            ),
          ),
        )}
      </svg>
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-meta text-pencil">
      Fewer
      {[0, 1, 2, 3, 5].map((n) => (
        <span key={n} aria-hidden className="inline-block size-[11px] rounded-[2px]" style={{ background: fill(n) }} />
      ))}
      More
    </div>
  );
}
