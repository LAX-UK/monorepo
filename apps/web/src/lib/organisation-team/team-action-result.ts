/** A Team or Organisation change: done, or refused in words a member can act on. */
export type TeamActionResult = { ok: true } | { ok: false; code: string | null; error: string };

const FALLBACK = "That didn't go through. Try again in a moment.";

const STATUS_COPY: Record<number, string> = {
  403: "Your role can't make this change. An owner or admin can.",
  404: "This has changed since the page opened. Refresh the page to see it.",
};

/**
 * The words for a refused change. The API answers with a code (`error`) and a sentence written
 * for clients (`message`); a code alone falls back to calm words by status, never the raw code.
 */
export function teamActionFailure(
  body: Record<string, unknown>,
  status: number,
): { code: string | null; error: string } {
  const code = typeof body.error === "string" ? body.error : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  // A sentence, not a code echoed back ("forbidden").
  if (message && /\s/.test(message)) return { code, error: message };
  return { code, error: STATUS_COPY[status] ?? FALLBACK };
}
