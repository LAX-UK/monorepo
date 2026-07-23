"use server";

import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { FINANCE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeFinanceApiError } from "./finance-action-errors";
import {
  isPayoutReversalConfirmationValid,
  isPayoutReversalReasonValid,
} from "./payout-settlement.vm";

function formValue(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function redirectManualReview(kind: "success" | "error", message: string): never {
  redirect(`/admin/payments?manualReview=1&${kind}=${encodeURIComponent(message)}`);
}

function redirectPayoutsList(kind: "success" | "error", message: string): never {
  redirect(`/admin/payouts?${kind}=${encodeURIComponent(message)}`);
}

function redirectSettlement(kind: "success" | "error", message: string): never {
  redirect(`/admin/payouts/settlement?${kind}=${encodeURIComponent(message)}`);
}

export async function captureManualReviewPaymentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "captureManualReviewPaymentAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) redirectManualReview("error", denied.message);

      const paymentId = formValue(formData, "paymentId");
      if (!paymentId) redirectManualReview("error", "payment_id_required");

      const res = await authedServerFetch(
        `/admin/payments/${encodeURIComponent(paymentId)}/capture-and-process`,
        { method: "POST" },
      );
      const error = await normalizeFinanceApiError(res, "capture_manual_review_failed");
      if (error) redirectManualReview("error", error);

      revalidatePath("/admin/payments");
      redirectManualReview("success", "payment_released_for_capture");
    },
    { formData },
  );
}

export async function refundManualReviewPaymentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "refundManualReviewPaymentAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) redirectManualReview("error", denied.message);

      const paymentId = formValue(formData, "paymentId");
      if (!paymentId) redirectManualReview("error", "payment_id_required");

      const res = await authedServerFetch(
        `/admin/payments/${encodeURIComponent(paymentId)}/refund-buyer`,
        { method: "POST" },
      );
      const error = await normalizeFinanceApiError(res, "refund_manual_review_failed");
      if (error) redirectManualReview("error", error);

      revalidatePath("/admin/payments");
      redirectManualReview("success", "buyer_refunded");
    },
    { formData },
  );
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalEntityId, dryRun: false }),
      });
      const error = await jsonOrError(res, "run_settlement_failed");
      if (error) redirectSettlement("error", error);

      revalidatePath("/admin/payouts");
      revalidatePath("/admin/payouts/settlement");
      redirectSettlement("success", settlementMessage("settlement_created"));
    },
    { formData },
  );
}

export async function addPayoutAdjustmentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "addPayoutAdjustmentAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) redirectPayoutsList("error", denied.message);

      const payoutId = formValue(formData, "payoutId");
      const amount = formValue(formData, "amount");
      const note = formValue(formData, "note");
      if (!payoutId) redirectPayoutsList("error", "payout_id_required");
      if (!amount || !note) redirectPayoutsList("error", "amount_and_note_required");

      const res = await authedServerFetch(
        `/admin/payouts/${encodeURIComponent(payoutId)}/adjustments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, note }),
        },
      );
      const error = await jsonOrError(res, "adjustment_failed");
      if (error) redirectPayoutsList("error", error);

      revalidatePath("/admin/payouts");
      redirectPayoutsList("success", "adjustment_added");
    },
    { formData },
  );
}

export async function markPayoutPaidAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "markPayoutPaidAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) redirectPayoutsList("error", denied.message);

      const payoutId = formValue(formData, "payoutId");
      const stripeTransferId = formValue(formData, "stripeTransferId");
      if (!payoutId) redirectPayoutsList("error", "payout_id_required");
      if (!stripeTransferId) redirectPayoutsList("error", "stripe_transfer_id_required");

      const res = await authedServerFetch(
        `/admin/payouts/${encodeURIComponent(payoutId)}/mark-paid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stripeTransferId }),
        },
      );
      const error = await jsonOrError(res, "mark_paid_failed");
      if (error) redirectPayoutsList("error", error);

      revalidatePath("/admin/payouts");
      redirectPayoutsList("success", "payout_marked_paid");
    },
    { formData },
  );
}

export async function reversePayoutAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "reversePayoutAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(FINANCE_ACCESS);
      if (!denied.ok) redirectPayoutsList("error", denied.message);

      const payoutId = formValue(formData, "payoutId");
      const reason = formValue(formData, "reason");
      const confirmationPhrase = formValue(formData, "confirmationPhrase");
      if (!payoutId) redirectPayoutsList("error", "payout_id_required");
      if (!isPayoutReversalReasonValid(reason)) redirectPayoutsList("error", "reason_min_length");

      if (!isPayoutReversalConfirmationValid(payoutId, confirmationPhrase)) {
        redirectPayoutsList("error", "confirmation_mismatch");
      }

      const res = await authedServerFetch(
        `/admin/payouts/${encodeURIComponent(payoutId)}/reverse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, confirmationPhrase }),
        },
      );
      const error = await jsonOrError(res, "reverse_payout_failed");
      if (error) redirectPayoutsList("error", error);

      revalidatePath("/admin/payouts");
      redirectPayoutsList("success", "payout_reversed");
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
