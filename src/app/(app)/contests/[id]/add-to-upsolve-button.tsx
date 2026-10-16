"use client";

import { useTransition } from "react";
import { addToUpsolve } from "@/app/contests/actions";

export function AddToUpsolveButton({ contestProblemId }: { contestProblemId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => addToUpsolve(contestProblemId))}
      className="h-8 rounded-md border border-ink px-3 text-meta font-medium hover:bg-paper disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add to upsolve queue"}
    </button>
  );
}
