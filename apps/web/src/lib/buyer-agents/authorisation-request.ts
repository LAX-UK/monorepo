import type { BuyerAgentAuthorisationView } from "@auction/types";
import {
  type AuthorisationDraft,
  type AuthorisationDraftErrors,
  londonToday,
  toAuthoriseBuyerAgentInput,
  validateAuthorisationDraft,
} from "./authorisation-draft";

export type AuthorisationActionResult =
  | { ok: true; authorisation: BuyerAgentAuthorisationView }
  | { ok: false; error: string; fieldErrors?: AuthorisationDraftErrors };

/** Plain words for the API's refusal codes, shared by the client and staff actions. */
const API_ERROR_COPY: Record<string, string> = {
  forbidden: "Only owners and admins can manage buyer agents.",
  member_not_buyer_agent: "That person no longer has the buyer agent role.",
  sale_not_open: "That sale is no longer open for bidding. Choose another sale.",
  invalid_window: "The end date must be in the future and after the start date.",
  authorisation_not_found: "That authorisation no longer exists. Refresh the page.",
  already_revoked: "That authorisation has already been revoked.",
};

export function authorisationErrorMessage(code: string | undefined, fallback: string): string {
  return (code && API_ERROR_COPY[code]) ?? fallback;
}

type Send = (path: string, body: unknown) => Promise<Response>;

async function readResult(res: Response, fallback: string): Promise<AuthorisationActionResult> {
  const body = (await res.json().catch(() => null)) as {
    data?: BuyerAgentAuthorisationView;
    error?: string;
  } | null;
  if (res.ok && body?.data) return { ok: true, authorisation: body.data };
  return { ok: false, error: authorisationErrorMessage(body?.error, fallback) };
}

/**
 * Validates a draft, converts it to the API body and posts it to `path`; the client and staff
 * server actions differ only in the path and how they send it.
 */
export async function submitAuthorisationDraft(
  send: Send,
  path: string,
  draft: AuthorisationDraft,
): Promise<AuthorisationActionResult> {
  const fieldErrors = validateAuthorisationDraft(draft, londonToday());
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  const res = await send(path, toAuthoriseBuyerAgentInput(draft));
  return readResult(res, "Could not save the authorisation. Try again.");
}

export async function submitAuthorisationRevoke(
  send: Send,
  path: string,
  reason: string,
): Promise<AuthorisationActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) return { ok: false, error: "Give a short reason." };
  const res = await send(path, { reason: trimmed });
  return readResult(res, "Could not revoke the authorisation. Try again.");
}
