"use server";

import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
import { redirectIfStaffStepUpRequired } from "@/lib/auth/step-up/staff-step-up.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { FINANCE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { IDEMPOTENCY_KEY_HEADER, idempotencyKeyFrom } from "./idempotency-key";
import {
  type SettlementResultCode,
  settlementResultForStatus,
  settlementResultHref,
} from "./settlement-result";

function formValue(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

const SETTLEMENT_PATH = "/admin/payouts/settlement";

function redirectSettlement(code: SettlementResultCode): never {
  redirect(settlementResultHref(code));
}

export async function runPayoutSettlementAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "runPayoutSettlementAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) redirectSettlement("not_permitted");

      const legalEntityId = formValue(formData, "legalEntityId");
      if (!legalEntityId) redirectSettlement("missing_seller");

      const res = await authedServerFetch("/admin/payouts/run-settlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [IDEMPOTENCY_KEY_HEADER]: idempotencyKeyFrom(formData),
        },
        body: JSON.stringify({ legalEntityId, dryRun: false }),
      });
      await redirectIfStaffStepUpRequired(res, SETTLEMENT_PATH);
      if (!res.ok) redirectSettlement(settlementResultForStatus(res.status));

      revalidatePath("/admin/payouts");
      revalidatePath("/admin/payouts/settlement");
      redirectSettlement("started");
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
