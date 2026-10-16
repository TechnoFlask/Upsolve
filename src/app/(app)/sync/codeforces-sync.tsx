"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { syncCodeforcesAction, type SyncState } from "@/app/sync/actions";
import { TIMEZONE, formatDay } from "@/lib/dates";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIMEZONE,
});

export function CodeforcesSync({ handle, lastSyncedAt }: { handle: string; lastSyncedAt: Date | null }) {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncCodeforcesAction, {});
  // Controlled, because React resets uncontrolled fields after a form action.
  const [value, setValue] = useState(handle);

  return (
    <section aria-labelledby="cf-heading" className="mt-8 rounded-lg border border-rule bg-sheet p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="cf-heading" className="text-lg font-semibold">
          Codeforces
        </h2>
        <p className="text-meta text-pencil">
          {lastSyncedAt
            ? `Last synced ${formatDay(lastSyncedAt)} at ${timeFormat.format(lastSyncedAt)}`
            : "Never synced"}
        </p>
      </div>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="cf-handle" className="text-meta text-pencil">
            Handle
          </label>
          <input
            id="cf-handle"
            name="handle"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="tourist"
            className="h-10 rounded-md border border-rule bg-sheet px-3 outline-none focus:border-ink"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-accepted px-4 font-medium text-white hover:bg-accepted-dark disabled:opacity-60"
        >
          {pending ? "Syncing…" : "Sync now"}
        </button>
      </form>
      <div aria-live="polite" className="mt-3 text-meta">
        {state.error && <p className="text-wrong">{state.error}</p>}
        {state.ok && (
          <p>
            {state.ok}{" "}
            <Link href="/contests" className="underline underline-offset-4">
              See your contests
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
