"use client";

import { useActionState } from "react";
import { unlock, type UnlockState } from "./actions";

export function UnlockForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlock, {});

  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="passcode" className="text-meta text-pencil">
        Passcode
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? "unlock-error" : undefined}
        className="h-11 rounded-md border border-rule bg-sheet px-3 text-base outline-none focus:border-ink"
      />
      {state.error && (
        <p id="unlock-error" role="alert" className="text-meta text-wrong">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded-md bg-accepted font-medium text-white hover:bg-accepted-dark disabled:opacity-60"
      >
        {pending ? "Unlocking…" : "Unlock"}
      </button>
    </form>
  );
}
