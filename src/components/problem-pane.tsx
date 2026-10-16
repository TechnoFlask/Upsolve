"use client";

import { createContext, useContext, useState } from "react";
import type { Problem } from "@/db/schema";
import { ProblemDialog } from "./problem-dialog";

const OpenProblemContext = createContext<((p: Problem) => void) | null>(null);

/**
 * Hosts the problem side pane for pages that aren't the Problems table
 * (contest list and contest detail), so any descendant can open it.
 */
export function ProblemPaneProvider({ allTags, children }: { allTags: string[]; children: React.ReactNode }) {
  const [open, setOpen] = useState<Problem | null>(null);
  return (
    <OpenProblemContext.Provider value={setOpen}>
      {children}
      <ProblemDialog problem={open} allTags={allTags} onClose={() => setOpen(null)} />
    </OpenProblemContext.Provider>
  );
}

export function useOpenProblem() {
  const open = useContext(OpenProblemContext);
  if (!open) throw new Error("useOpenProblem must be used inside ProblemPaneProvider");
  return open;
}
