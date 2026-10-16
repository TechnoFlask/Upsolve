import Link from "next/link";
import { PLATFORM_NAMES, tierColor } from "@/lib/difficulty";

const BAR = 22;
const GAP = 6;
const H = 160;
const LABEL = 18;

/** Solved problems per rating, each bar in its tier colour. */
export function RatingHistogram({
  buckets,
  platform,
}: {
  buckets: { rating: number; count: number }[];
  platform: "codeforces" | "atcoder";
}) {
  // Thin out axis labels as the range widens (AtCoder spans 0 to 3000+).
  const labelEvery = buckets.length <= 12 ? 100 : buckets.length <= 24 ? 200 : 400;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const width = buckets.length * (BAR + GAP);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${H + LABEL}`} width={width} height={H + LABEL} role="img" aria-label={`Solved ${PLATFORM_NAMES[platform]} problems by difficulty`} className="block">
        {buckets.map((b, i) => {
          const h = (b.count / max) * (H - 16);
          const x = i * (BAR + GAP);
          return (
            <Link key={b.rating} href={`/?platform=${platform}&minDifficulty=${b.rating}&maxDifficulty=${b.rating + 99}&status=solved`}>
              <title>{`${b.rating}: ${b.count} solved`}</title>
              <rect x={x} y={H - h} width={BAR} height={Math.max(h, b.count ? 2 : 0)} rx={3} fill={tierColor(platform, b.rating)} />
              {b.count > 0 && (
                <text x={x + BAR / 2} y={H - h - 4} textAnchor="middle" className="fill-ink text-[10px] tabular">
                  {b.count}
                </text>
              )}
              {b.rating % labelEvery === 0 && (
                <text x={x + BAR / 2} y={H + 13} textAnchor="middle" className="fill-pencil text-[9px] tabular">
                  {b.rating}
                </text>
              )}
            </Link>
          );
        })}
      </svg>
    </div>
  );
}
