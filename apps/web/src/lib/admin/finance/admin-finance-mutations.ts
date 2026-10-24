"use server";

import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
import { redirectIfStaffStepUpRequired } from "@/lib/auth/step-up/staff-step-up.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { FINANCE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { IDEMPOTENCY_KEY_HEADER, idempotencyKeyFrom } from "./idempotency-key";

function formValue(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

const SETTLEMENT_PATH = "/admin/payouts/settlement";

function redirectSettlement(kind: "success" | "error", message: string): never {
  redirect(`/admin/payouts/settlement?${kind}=${encodeURIComponent(message)}`);
}

const SETTLEMENT_ERROR_MESSAGES: Record<string, string> = {
  legal_entity_id_required: "Select a legal entity before running settlement.",
  run_settlement_failed: "Settlement could not be completed. Try again or contact support.",
  settlement_created: "Settlement run started successfully.",
};

function settlementMessage(code: string): string {
  return SETTLEMENT_ERROR_MESSAGES[code] ?? code;
}

async function jsonOrError(res: Response, fallback: string): Promise<string | null> {
  if (res.ok) return null;
  let message = fallback;
  try {
    const body = (await res.json()) as { error?: unknown };
    message = normalizeApiErrorMessage(body.error, message);
  } catch {
    // Keep fallback when the API did not return JSON.
  }
  return `${message} (${res.status})`;
}

export async function runPayoutSettlementAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "runPayoutSettlementAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) redirectSettlement("error", denied.message);

      const legalEntityId = formValue(formData, "legalEntityId");
      if (!legalEntityId) {
        redirectSettlement("error", settlementMessage("legal_entity_id_required"));
      }

      const res = await authedServerFetch("/admin/payouts/run-settlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [IDEMPOTENCY_KEY_HEADER]: idempotencyKeyFrom(formData),
        },
        body: JSON.stringify({ legalEntityId, dryRun: false }),
      });
      await redirectIfStaffStepUpRequired(res, SETTLEMENT_PATH);
      const error = await jsonOrError(res, "run_settlement_failed");
      if (error) redirectSettlement("error", error);

      revalidatePath("/admin/payouts");
      revalidatePath("/admin/payouts/settlement");
      redirectSettlement("success", settlementMessage("settlement_created"));
    },
    { formData },
  );
}

export async function assertFinanceMutationAccess(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
  if (denied && !denied.ok) {
    return { ok: false, message: denied.error };
  }
  return { ok: true };
}
