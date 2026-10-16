import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, NoObjectGeneratedError, type LanguageModel } from "ai";

export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

export type ModelChoice = { model: LanguageModel; id: string };

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** The configured OpenRouter model. Throws a readable error when no key is set. */
export function defaultModel(): ModelChoice {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Add OPENROUTER_API_KEY to your environment to use AI features.");
  const id = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const openrouter = createOpenRouter({ apiKey, headers: { "X-Title": "Upsolve" } });
  return { model: openrouter(id), id };
}

/** Turn AI SDK errors into messages worth showing in the UI. */
export function describeAiError(e: unknown): string {
  if (APICallError.isInstance(e)) {
    if (e.statusCode === 401) return "OpenRouter rejected the API key. Check OPENROUTER_API_KEY.";
    if (e.statusCode === 402) return "Your OpenRouter account is out of credits.";
    if (e.statusCode === 429) return "OpenRouter is rate-limiting requests. Try again in a minute.";
    return `OpenRouter error: ${e.message}`;
  }
  if (NoObjectGeneratedError.isInstance(e)) return "The model's answer was incomplete. Try again.";
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return "The model took too long to answer. Try again.";
  }
  return e instanceof Error ? e.message : String(e);
}
