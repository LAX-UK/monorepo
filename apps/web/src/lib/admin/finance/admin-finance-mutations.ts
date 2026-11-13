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

/** The API asks for at least this many characters of reason. */
const SETTLEMENT_REASON_MIN = 10;
const SETTLEMENT_PATH = "/admin/payouts/settlement";

function redirectSettlement(code: SettlementResultCode): never {
  redirect(settlementResultHref(code));
}

/** A refusal the settlement dialog shows in place instead of leaving the page. */
export type SettlementRunOutcome = { error: "figures_changed" } | undefined;

/**
 * The confirmed preview the form carries, as JSON. `undefined` when it is missing or malformed:
 * the run is never sent without the figures the person confirmed.
 */
function confirmedFrom(formData: FormData): Record<string, unknown> | undefined {
  const raw = formValue(formData, "confirmed");
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function runPayoutSettlementAction(formData: FormData): Promise<SettlementRunOutcome> {
  return instrumentServerAction(
    "runPayoutSettlementAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) redirectSettlement("not_permitted");

      const legalEntityId = formValue(formData, "legalEntityId");
      if (!legalEntityId) redirectSettlement("missing_seller");
      const reason = formValue(formData, "reason");
      if (reason.length < SETTLEMENT_REASON_MIN) redirectSettlement("reason_required");
      // Nothing confirmed to bind the run to: ask for a fresh preview rather than pay unbound.
      const confirmed = confirmedFrom(formData);
      if (!confirmed) return { error: "figures_changed" } as const;

      const res = await authedServerFetch("/admin/payouts/run-settlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [IDEMPOTENCY_KEY_HEADER]: idempotencyKeyFrom(formData),
        },
        body: JSON.stringify({
          legalEntityId,
          dryRun: false,
          reason,
          confirmed,
        }),
      });
      await redirectIfStaffStepUpRequired(res, SETTLEMENT_PATH);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        // The run would pay something other than what was confirmed: say so in the dialog.
        if (res.status === 409 && body.error === "figures_changed") {
          return { error: "figures_changed" } as const;
        }
        const periodRefused =
          res.status === 409 &&
          typeof body.error === "string" &&
          body.error.startsWith("settlement_period_");
        redirectSettlement(
          periodRefused ? "period_conflict" : settlementResultForStatus(res.status),
        );
      }

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
