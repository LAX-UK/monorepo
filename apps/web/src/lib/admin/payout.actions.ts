"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function value(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function redirectWith(kind: "success" | "error", message: string): never {
  redirect(`/admin/payouts?${kind}=${encodeURIComponent(message)}`);
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
      const legalEntityId = value(formData, "legalEntityId");
      if (!legalEntityId) redirectWith("error", "legal_entity_id_required");

      const res = await authedServerFetch("/admin/payouts/run-settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalEntityId, dryRun: false }),
      });
      const error = await jsonOrError(res, "run_settlement_failed");
      if (error) redirectWith("error", error);

      revalidatePath("/admin/payouts");
      redirectWith("success", "settlement_created");
    },
    { formData },
  );
}

export async function addPayoutAdjustmentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "addPayoutAdjustmentAction",
    async () => {
      const payoutId = value(formData, "payoutId");
      const amount = value(formData, "amount");
      const note = value(formData, "note");
      if (!payoutId) redirectWith("error", "payout_id_required");
      if (!amount || !note) redirectWith("error", "amount_and_note_required");

      const res = await authedServerFetch(
        `/admin/payouts/${encodeURIComponent(payoutId)}/adjustments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, note }),
        },
      );
      const error = await jsonOrError(res, "adjustment_failed");
      if (error) redirectWith("error", error);

      revalidatePath("/admin/payouts");
      redirectWith("success", "adjustment_added");
    },
    { formData },
  );
}

export async function markPayoutPaidAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "markPayoutPaidAction",
    async () => {
      const payoutId = value(formData, "payoutId");
      const stripeTransferId = value(formData, "stripeTransferId");
      if (!payoutId) redirectWith("error", "payout_id_required");
      if (!stripeTransferId) redirectWith("error", "stripe_transfer_id_required");

      const res = await authedServerFetch(
        `/admin/payouts/${encodeURIComponent(payoutId)}/mark-paid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stripeTransferId }),
        },
      );
      const error = await jsonOrError(res, "mark_paid_failed");
      if (error) redirectWith("error", error);

      revalidatePath("/admin/payouts");
      redirectWith("success", "payout_marked_paid");
    },
    { formData },
  );
}

export async function reversePayoutAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "reversePayoutAction",
    async () => {
      const payoutId = value(formData, "payoutId");
      const reason = value(formData, "reason");
      const confirmationPhrase = value(formData, "confirmationPhrase");
      if (!payoutId) redirectWith("error", "payout_id_required");
      if (reason.length < 10) redirectWith("error", "reason_min_length");

      const expected = `REVERSE PAYOUT ${payoutId}`;
      if (confirmationPhrase !== expected) {
        redirectWith("error", "confirmation_mismatch");
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
      if (error) redirectWith("error", error);

      revalidatePath("/admin/payouts");
      redirectWith("success", "payout_reversed");
    },
    { formData },
  );
}
