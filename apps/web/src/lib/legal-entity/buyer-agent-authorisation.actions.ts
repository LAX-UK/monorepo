"use server";

import type { AuthorisationDraft } from "@/lib/buyer-agents/authorisation-draft";
import {
  type AuthorisationActionResult,
  submitAuthorisationDraft,
  submitAuthorisationRevoke,
} from "@/lib/buyer-agents/authorisation-request";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { teamHref } from "@/lib/navigation/client-routes";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { X_LEGAL_ENTITY_ID_HEADER } from "./client-acting-context";

function sender(legalEntityId: string) {
  return (path: string, body: unknown) =>
    authedServerFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
      body: JSON.stringify(body),
    });
}

function revalidateMembers() {
  revalidatePath(teamHref());
}

/** An owner or admin authorises a buyer-agent member to bid for the organisation. */
export async function authoriseBuyerAgentAction(
  legalEntityId: string,
  draft: AuthorisationDraft,
): Promise<AuthorisationActionResult> {
  return instrumentServerAction("authoriseBuyerAgentAction", async () => {
    const result = await submitAuthorisationDraft(
      sender(legalEntityId),
      "/legal-entities/buyer-agent-authorisations",
      draft,
    );
    if (result.ok) revalidateMembers();
    return result;
  });
}

/** An owner or admin revokes an authorisation, with a reason. */
export async function revokeBuyerAgentAuthorisationAction(
  legalEntityId: string,
  authorisationId: string,
  reason: string,
): Promise<AuthorisationActionResult> {
  return instrumentServerAction("revokeBuyerAgentAuthorisationAction", async () => {
    const result = await submitAuthorisationRevoke(
      sender(legalEntityId),
      `/legal-entities/buyer-agent-authorisations/${encodeURIComponent(authorisationId)}/revoke`,
      reason,
    );
    if (result.ok) revalidateMembers();
    return result;
  });
}
