"use server";

import { legalEntityDetailTabHref } from "@/lib/admin/catalog/detail-tab-compat";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import type { AuthorisationDraft } from "@/lib/buyer-agents/authorisation-draft";
import {
  type AuthorisationActionResult,
  submitAuthorisationDraft,
  submitAuthorisationRevoke,
} from "@/lib/buyer-agents/authorisation-request";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";

async function send(path: string, body: unknown) {
  return authedServerFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function denied(): Promise<AuthorisationActionResult | null> {
  const denial = await denyUnlessAdminCapability("legal_entity.write");
  return denial && !denial.ok ? { ok: false, error: denial.error } : null;
}

function base(legalEntityId: string) {
  return `/admin/legal-entities/${encodeURIComponent(legalEntityId)}/buyer-agent-authorisations`;
}

/** Staff authorise a buyer agent on the organisation's behalf. */
export async function adminAuthoriseBuyerAgentAction(
  legalEntityId: string,
  draft: AuthorisationDraft,
): Promise<AuthorisationActionResult> {
  return instrumentServerAction("adminAuthoriseBuyerAgentAction", async () => {
    const refusal = await denied();
    if (refusal) return refusal;
    const result = await submitAuthorisationDraft(send, base(legalEntityId), draft);
    if (result.ok) revalidatePath(legalEntityDetailTabHref(legalEntityId, "buyer-agents"));
    return result;
  });
}

/** Staff revoke an authorisation, with a reason kept in the audit log. */
export async function adminRevokeBuyerAgentAuthorisationAction(
  legalEntityId: string,
  authorisationId: string,
  reason: string,
): Promise<AuthorisationActionResult> {
  return instrumentServerAction("adminRevokeBuyerAgentAuthorisationAction", async () => {
    const refusal = await denied();
    if (refusal) return refusal;
    const result = await submitAuthorisationRevoke(
      send,
      `${base(legalEntityId)}/${encodeURIComponent(authorisationId)}/revoke`,
      reason,
    );
    if (result.ok) revalidatePath(legalEntityDetailTabHref(legalEntityId, "buyer-agents"));
    return result;
  });
}
