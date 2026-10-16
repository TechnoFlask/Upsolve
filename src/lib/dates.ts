// Dates are stored as UTC instants and shown in one fixed display timezone, so
// server and client render the same day (and a 1 a.m. IST solve isn't shown as
// the previous day, as it would be in UTC).
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";

const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIMEZONE,
});

// en-CA formats as YYYY-MM-DD, the value <input type="date"> expects.
const inputFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE });

export function formatDay(date: Date): string {
  return dayFormat.format(date);
}

export function toDateInput(date: Date): string {
  return inputFormat.format(date);
}

function offsetMs(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(at)
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight at the start of a "YYYY-MM-DD" day in the display timezone. */
export function startOfDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - offsetMs(new Date(guess)));
}

/** Noon on a "YYYY-MM-DD" day: what a manually entered date is stored as. */
export function middayOf(day: string): Date {
  return new Date(startOfDay(day).getTime() + DAY_MS / 2);
}

export function endOfDayExclusive(day: string): Date {
  return new Date(startOfDay(day).getTime() + DAY_MS);
}
