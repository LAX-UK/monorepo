import type { UnappliedMoney } from "@auction/domain";
import type { IPaymentGroupRepository, PaymentGroupRecord } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

/** How far back a bank-transfer payment can still be named as a possible source of the balance. */
export const POSSIBLE_SOURCE_LOOKBACK_MS = 30 * 86_400_000;

type PossibleGroup = NonNullable<UnappliedMoney["possibleGroup"]>;

/**
 * The one recent bank-transfer payment, in this currency, the balance might belong to, or `null`.
 * A balance is the sum of everything left over, so it cannot say which payment it came from: with
 * no candidate, or with more than one, nothing is suggested.
 */
export function possibleSourceGroup(
  candidates: readonly PaymentGroupRecord[],
  currency: string,
): PossibleGroup | null {
  const fits = candidates.filter((g) => g.currency.toLowerCase() === currency.toLowerCase());
  const [only] = fits;
  if (fits.length !== 1 || !only) return null;
  if (only.status !== "open" && only.status !== "processing" && only.status !== "paid") return null;
  return { id: only.id, status: only.status };
}

/**
 * Stripe sends `cash_balance.funds_available` when money is left in the buyer's balance after it
 * applied what it could to open payments: a transfer after the invoice was cancelled, a second
 * transfer, or more than was due. `balance.available` is the whole balance, not what this transfer
 * added, so the task states the balance and nothing more. Finance decides what to do with it,
 * never an automatic refund.
 *
 * When exactly one recent bank-transfer payment of the buyer's account could explain it, the task
 * carries that payment as a suggestion to check. It is never stated as the cause.
 */
export async function handleCustomerBalanceFundsAvailable(
  deps: StripePaymentWebhookDeps,
  event: Stripe.Event,
  balance: Stripe.CashBalance,
  groups: Pick<IPaymentGroupRepository, "findBankTransferGroupsForCustomer"> | null = null,
): Promise<PaymentWebhookResult> {
  const candidates =
    groups && typeof balance.customer === "string"
      ? await groups.findBankTransferGroupsForCustomer(
          balance.customer,
          new Date(Date.now() - POSSIBLE_SOURCE_LOOKBACK_MS),
        )
      : [];
  return deps.transactionRunner.runInTransaction(async (tx) => {
    const { claimed } = await tryClaimProcessedStripeEvent(
      tx,
      event.id,
      PAYMENT_WEBHOOK_EVENT_SOURCE,
    );
    if (!claimed) return { processed: false, action: "skipped", reason: "duplicate_event" };
    const available = Object.entries(balance.available ?? {}).filter(([, cents]) => cents > 0);
    for (const [currency, amountCents] of available) {
      await deps.unappliedMoney.record(
        tx,
        {
          reason: "customer_balance_unapplied",
          paymentId: null,
          paymentGroupId: null,
          possibleGroup: possibleSourceGroup(candidates, currency),
          stripePaymentIntentId: null,
          stripeChargeId: null,
          stripeCustomerId: balance.customer,
          stripeEventId: `${event.id}:${currency}`,
          amountCents,
          currency,
        },
        null,
      );
    }
    return available.length > 0
      ? { processed: true, action: "customer_balance_unapplied" }
      : { processed: true, action: "skipped", reason: "no_balance_left" };
  });
}
