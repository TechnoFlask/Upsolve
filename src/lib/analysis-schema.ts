import { z } from "zod";

// What the model must return for a solution analysis. Shared by the server
// (validation) and the side pane (display).
export const solutionAnalysisSchema = z.object({
  approach: z.string().min(1),
  pseudocode: z.string().min(1),
  time: z.string().min(1),
  space: z.string().min(1),
  complexityReasoning: z.string().min(1),
  isOptimal: z.boolean(),
  optimalTime: z.string().nullable(),
  optimalSpace: z.string().nullable(),
  hints: z.array(z.string().min(1)).max(5),
  assumptions: z.string().nullable(),
  /** Topic tags (Codeforces vocabulary) for the techniques the solution uses. Missing on older analyses. */
  suggestedTags: z.array(z.string()).max(8),
});

export type SolutionAnalysis = z.infer<typeof solutionAnalysisSchema>;

/** Analyses saved before tag suggestions existed have no suggestedTags. */
export const suggestedTagsOf = (a: SolutionAnalysis): string[] => a.suggestedTags ?? [];
