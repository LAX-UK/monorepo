"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { organisationHref, teamHref } from "@/lib/navigation/client-routes";
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

export type TwoStepReminderResult = { ok: true; reminded: number } | { ok: false; error: string };

/**
 * Emails the members without two-step on. The API's own sentence comes back for a refusal it
 * explains (nobody to remind, already sent today).
 */
export async function remindTwoStepAction(legalEntityId: string): Promise<TwoStepReminderResult> {
  return instrumentServerAction("remindTwoStepAction", async () => {
    const res = await authedServerFetch("/legal-entities/two-step-reminders", {
      method: "POST",
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: { reminded?: number };
      message?: string;
    };
    if (res.ok) return { ok: true, reminded: body.data?.reminded ?? 0 };
    if ((res.status === 409 || res.status === 429) && body.message) {
      return { ok: false, error: body.message };
    }
    if (res.status === 403) return { ok: false, error: "You don't have permission to do this." };
    return { ok: false, error: "We couldn't send the reminder. Try again in a moment." };
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
    revalidatePath(organisationHref("security"));
    revalidatePath(teamHref());
    return { ok: true };
  });
}
