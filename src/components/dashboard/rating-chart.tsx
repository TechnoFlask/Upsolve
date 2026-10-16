import { formatDay } from "@/lib/dates";
import { ATCODER, CODEFORCES, PLATFORM_NAMES, tierColor } from "@/lib/difficulty";

export type RatingPoint = { date: Date; rating: number; contest: string; delta: number };

const W = 640;
const H = 240;
const PAD = { left: 40, right: 12, top: 12, bottom: 24 };

/** Rating over time, drawn over the judge's tier bands like its own graph. */
export function RatingChart({ points, platform }: { points: RatingPoint[]; platform: "codeforces" | "atcoder" }) {
  const tiers = platform === "codeforces" ? CODEFORCES : ATCODER;
  const ratings = points.map((p) => p.rating);
  let lo = Math.max(0, Math.floor((Math.min(...ratings) - 150) / 100) * 100);
  let hi = Math.ceil((Math.max(...ratings) + 150) / 100) * 100;
  if (hi - lo < 600) {
    const mid = (hi + lo) / 2;
    lo = Math.max(0, Math.round((mid - 300) / 100) * 100);
    hi = lo + 600;
  }

  const t0 = points[0].date.getTime();
  const t1 = points[points.length - 1].date.getTime();
  const x = (d: Date) =>
    t1 === t0 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((d.getTime() - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (r: number) => PAD.top + (1 - (r - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const bands = tiers.map((tier, i) => ({
    from: i === 0 ? 0 : tiers[i - 1].below,
    to: tier.below,
    color: tier.color,
    name: tier.name,
  })).filter((b) => b.to > lo && b.from < hi);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${PLATFORM_NAMES[platform]} rating history, now ${ratings.at(-1)}`}>
      {bands.map((b) => {
        const top = y(Math.min(b.to, hi));
        const bottom = y(Math.max(b.from, lo));
        return (
          <g key={b.name}>
            <rect x={PAD.left} y={top} width={W - PAD.left - PAD.right} height={bottom - top} fill={b.color} opacity={0.14} />
            {b.from > lo && (
              <text x={PAD.left - 6} y={bottom + 3} textAnchor="end" className="fill-pencil text-[10px] tabular">
                {b.from}
              </text>
            )}
          </g>
        );
      })}
      {points.length > 1 && (
        <polyline
          points={points.map((p) => `${x(p.date)},${y(p.rating)}`).join(" ")}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={1.5}
        />
      )}
      {points.map((p) => (
        <circle key={p.date.getTime()} cx={x(p.date)} cy={y(p.rating)} r={4} fill="white" stroke={tierColor(platform, p.rating)} strokeWidth={2}>
          <title>{`${p.contest}, ${formatDay(p.date)}: ${p.rating} (${p.delta >= 0 ? "+" : "−"}${Math.abs(p.delta)})`}</title>
        </circle>
      ))}
      <text x={PAD.left} y={H - 6} className="fill-pencil text-[10px]">
        {formatDay(points[0].date)}
      </text>
      {points.length > 1 && (
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-pencil text-[10px]">
          {formatDay(points[points.length - 1].date)}
        </text>
      )}
    </svg>
  );
}
