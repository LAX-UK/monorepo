"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";

export type TwoFactorPolicyActionResult = { ok: true } | { ok: false; error: string };

function failure(status: number): TwoFactorPolicyActionResult {
  if (status === 403) return { ok: false, error: "You don't have permission to change this." };
  return { ok: false, error: "We couldn't save this setting. Try again." };
}

export async function setStaffTwoFactorPolicyAction(
  required: boolean,
): Promise<TwoFactorPolicyActionResult> {
  return instrumentServerAction("setStaffTwoFactorPolicyAction", async () => {
    const res = await authedServerFetch("/admin/security/staff-two-factor", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ required }),
    });
    if (!res.ok) return failure(res.status);
    revalidatePath("/admin/settings/security");
    return { ok: true };
  });
}

export async function setOrgTwoFactorPolicyAction(
  legalEntityId: string,
  required: boolean,
): Promise<TwoFactorPolicyActionResult> {
  return instrumentServerAction("setOrgTwoFactorPolicyAction", async () => {
    const res = await authedServerFetch("/legal-entities/two-factor-policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json", [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
      body: JSON.stringify({ required }),
    });
    if (!res.ok) return failure(res.status);
    revalidatePath(`/dashboard/organisations/${legalEntityId}/members`);
    return { ok: true };
  });
}
