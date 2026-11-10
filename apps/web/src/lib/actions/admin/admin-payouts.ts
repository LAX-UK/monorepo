"use server";

import { idempotencyHeader } from "@/lib/admin/finance/idempotency-key";
import {
  isPayoutReversalReasonValid,
  payoutReversalConfirmationPhrase,
} from "@/lib/admin/finance/payout-settlement.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { stepUpRequiredFailure } from "@/lib/auth/step-up/step-up-failure";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { FINANCE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { PAYOUT_ACTION_REASON_MIN, normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";

const NOTE_MIN = PAYOUT_ACTION_REASON_MIN;
/** A signed pounds amount as the API takes it: "-25.00", at most two decimals. */
const SIGNED_AMOUNT = /^-?\d+(\.\d{1,2})?$/;

type PayoutCall = { ok: true } | ReturnType<typeof actionFailure>;

/** The API's answer as an action result; a stale sign-in becomes the step-up code. */
async function payoutCallResult(res: Response, fallback: string): Promise<PayoutCall> {
  if (res.ok) return { ok: true };
  if (await isStaffStepUpResponse(res)) {
    return stepUpRequiredFailure();
  }
  let message = fallback;
  try {
    const body = (await res.json()) as { error?: unknown };
    message = normalizeApiErrorMessage(body.error, fallback);
  } catch {
    // The API did not answer with JSON; the fallback says what failed.
  }
  return actionFailure(message, undefined, res.status);
}

/** Records a payout as paid against the Stripe transfer that moved the money. */
export async function adminMarkPayoutPaidResultAction(
  payoutId: string,
  input: { stripeTransferId: string; reason: string; idempotencyKey?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminMarkPayoutPaidResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = payoutId.trim();
    const stripeTransferId = input.stripeTransferId.trim();
    const reason = input.reason.trim();
    if (!id) return actionFailure("Missing payout");
    if (!stripeTransferId) return actionFailure("Enter the Stripe transfer ID.");
    if (reason.length < NOTE_MIN) {
      return actionFailure(`Enter a reason of at least ${NOTE_MIN} characters.`);
    }
    const res = await authedServerFetch(`/admin/payouts/${encodeURIComponent(id)}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...idempotencyHeader(input.idempotencyKey) },
      body: JSON.stringify({ stripeTransferId, reason }),
    });
    const result = await payoutCallResult(res, "The payout could not be marked as paid.");
    if (!result.ok) return result;
    revalidatePath("/admin/payouts");
    return actionSuccess();
  });
}

/** Adds a signed adjustment line to a payout that has not been paid yet. */
export async function adminAddPayoutAdjustmentResultAction(
  payoutId: string,
  input: { amount: string; note: string; idempotencyKey?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminAddPayoutAdjustmentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = payoutId.trim();
    const amount = input.amount.trim();
    const note = input.note.trim();
    if (!id) return actionFailure("Missing payout");
    if (!SIGNED_AMOUNT.test(amount) || Number(amount) === 0) {
      return actionFailure("Enter an amount in pounds, such as -25.00 or 40.00.");
    }
    if (note.length < NOTE_MIN) {
      return actionFailure(`Enter a reason of at least ${NOTE_MIN} characters.`);
    }
    const res = await authedServerFetch(`/admin/payouts/${encodeURIComponent(id)}/adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...idempotencyHeader(input.idempotencyKey) },
      body: JSON.stringify({ amount, note }),
    });
    const result = await payoutCallResult(res, "The adjustment could not be added.");
    if (!result.ok) return result;
    revalidatePath("/admin/payouts");
    return actionSuccess();
  });
}

/** Marks a paid or in-transit payout as reversed in the finance records. */
export async function adminReversePayoutResultAction(
  payoutId: string,
  input: { reason: string; idempotencyKey?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminReversePayoutResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = payoutId.trim();
    const reason = input.reason.trim();
    if (!id) return actionFailure("Missing payout");
    if (!isPayoutReversalReasonValid(reason, NOTE_MIN)) {
      return actionFailure(`Enter a reason of at least ${NOTE_MIN} characters.`);
    }
    const res = await authedServerFetch(`/admin/payouts/${encodeURIComponent(id)}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...idempotencyHeader(input.idempotencyKey) },
      body: JSON.stringify({ reason, confirmationPhrase: payoutReversalConfirmationPhrase(id) }),
    });
    const result = await payoutCallResult(res, "The payout could not be reversed.");
    if (!result.ok) return result;
    revalidatePath("/admin/payouts");
    return actionSuccess();
  });
}

/** What staff are told when the API refuses a retry, by the reason it gives. */
const RETRY_REFUSALS: Record<string, string> = {
  payout_not_failed: "This payout is no longer failed, so there is nothing to retry.",
  payout_state_changed: "This payout changed while you were retrying it. Refresh and check it.",
  connect_not_ready:
    "The seller's Stripe account cannot receive transfers yet. Ask them to finish their Stripe setup.",
  no_connect_account: "The seller has no Stripe account connected.",
  stripe_error: "Stripe declined the transfer again. The reason is shown on the payout.",
  retry_too_soon: "Wait a few minutes: Stripe may still be finishing the last attempt",
  transfer_blocked:
    "Stripe already holds a transfer for this payout, so it is blocked. Resolve it from the payout.",
  negative_net_amount: "This payout has a negative net amount, so no transfer can be sent.",
};

/** Sends the Stripe transfer again for a payout whose earlier transfer failed. */
export async function adminRetryPayoutTransferResultAction(
  payoutId: string,
  input: { reason: string; idempotencyKey?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRetryPayoutTransferResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = payoutId.trim();
    const reason = input.reason.trim();
    if (!id) return actionFailure("Missing payout");
    if (reason.length < NOTE_MIN) {
      return actionFailure(`Enter a reason of at least ${NOTE_MIN} characters.`);
    }
    const res = await authedServerFetch(`/admin/payouts/${encodeURIComponent(id)}/retry-transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...idempotencyHeader(input.idempotencyKey) },
      body: JSON.stringify({ confirmed: true, reason }),
    });
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as { error?: unknown };
      const reason = typeof body.error === "string" ? body.error : "";
      return actionFailure(
        RETRY_REFUSALS[reason] ?? "The transfer could not be retried.",
        undefined,
        409,
      );
    }
    const result = await payoutCallResult(res, "The transfer could not be retried.");
    if (!result.ok) return result;
    revalidatePath("/admin/payouts");
    return actionSuccess();
  });
}

/** What staff are told when the API refuses to resolve a blocked payout, by the reason it gives. */
const BLOCKED_REFUSALS: Record<string, string> = {
  payout_not_blocked: "This payout is no longer blocked. Refresh and check it.",
  payout_state_changed: "This payout changed while you were resolving it. Refresh and check it.",
  transfer_linked_to_other_payout: "That Stripe transfer is already linked to another payout.",
};

/** A refused resolution in the API's own words when it gave them, else fixed copy by reason. */
async function blockedResolutionResult(res: Response): Promise<PayoutCall> {
  if (res.status !== 409) {
    return payoutCallResult(res, "The blocked payout could not be resolved.");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: unknown; message?: unknown };
  const reason = typeof body.error === "string" ? body.error : "";
  const message = typeof body.message === "string" && body.message ? body.message : "";
  return actionFailure(
    BLOCKED_REFUSALS[reason] ?? (message || "The blocked payout could not be resolved."),
    undefined,
    409,
  );
}

/**
 * Takes a Stripe transfer for a blocked payout. The API fetches it from Stripe and checks the
 * account, currency, amount and that it is not reversed or linked to another payout.
 */
export async function adminAdoptBlockedPayoutTransferResultAction(
  payoutId: string,
  input: { stripeTransferId: string; reason: string; idempotencyKey?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminAdoptBlockedPayoutTransferResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = payoutId.trim();
    const stripeTransferId = input.stripeTransferId.trim();
    const reason = input.reason.trim();
    if (!id) return actionFailure("Missing payout");
    if (!stripeTransferId) return actionFailure("Enter the Stripe transfer ID.");
    if (reason.length < NOTE_MIN) {
      return actionFailure(`Enter a reason of at least ${NOTE_MIN} characters.`);
    }
    const res = await authedServerFetch(
      `/admin/payouts/${encodeURIComponent(id)}/resolve-blocked`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idempotencyHeader(input.idempotencyKey) },
        body: JSON.stringify({ resolution: "adopt_transfer", stripeTransferId, reason }),
      },
    );
    const result = await blockedResolutionResult(res);
    if (!result.ok) return result;
    revalidatePath("/admin/payouts");
    return actionSuccess();
  });
}

/**
 * Sends a blocked payout back to failed so it can be retried, once staff have checked in Stripe
 * that no live transfer exists. The confirmation and reason are kept with the payout.
 */
export async function adminReleaseBlockedPayoutResultAction(
  payoutId: string,
  input: { reason: string; noLiveTransferConfirmed: boolean; idempotencyKey?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminReleaseBlockedPayoutResultAction", async () => {
    const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
    if (denied) return denied;
    const id = payoutId.trim();
    const reason = input.reason.trim();
    if (!id) return actionFailure("Missing payout");
    if (!input.noLiveTransferConfirmed) {
      return actionFailure("Confirm that you have checked in Stripe that no live transfer exists.");
    }
    if (reason.length < NOTE_MIN) {
      return actionFailure(`Enter a reason of at least ${NOTE_MIN} characters.`);
    }
    const res = await authedServerFetch(
      `/admin/payouts/${encodeURIComponent(id)}/resolve-blocked`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idempotencyHeader(input.idempotencyKey) },
        body: JSON.stringify({
          resolution: "release_to_failed",
          noLiveTransferConfirmed: true,
          reason,
        }),
      },
    );
    const result = await blockedResolutionResult(res);
    if (!result.ok) return result;
    revalidatePath("/admin/payouts");
    return actionSuccess();
  });
}
