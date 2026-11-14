/**
 * What the payment provider says about an invoice's money once its open checkouts are closed.
 * The expiry job cancels an invoice only on `no_money`.
 */
export type ProviderMoneyState =
  /**
   * Every checkout is closed and nothing was paid or is on its way. `alreadyClosed` is set when
   * nothing was open to close on this call (closed earlier, by a past run or by Stripe itself).
   */
  | { kind: "no_money"; alreadyClosed?: true }
  /** The money arrived. */
  | {
      kind: "paid";
      paymentIntentId: string;
      chargeId: string | null;
      amountReceivedPence: number;
    }
  /** Money is on its way: a card or transfer still processing, or a transfer received in part. */
  | { kind: "in_flight"; paymentIntentId: string; reason: "processing" | "transfer_part_funded" }
  /** The provider could not be asked or answered unexpectedly; try again on the next run. */
  | { kind: "unknown"; error: string };

export type StaleExpiryAction = "cancel" | "record_paid" | "keep_in_flight" | "retry_later";

const ACTION: Record<ProviderMoneyState["kind"], StaleExpiryAction> = {
  no_money: "cancel",
  paid: "record_paid",
  in_flight: "keep_in_flight",
  unknown: "retry_later",
};

/** The one rule: an invoice is cancelled for being stale only when no money can still reach it. */
export function staleExpiryAction(state: ProviderMoneyState): StaleExpiryAction {
  return ACTION[state.kind];
}

/** Closes an invoice's open checkouts at the provider, then reports its money. */
export interface IPaymentProviderCloser {
  closeAndRead(input: {
    paymentId: string;
    paymentIntentId: string | null;
    checkoutSessionIds: readonly string[];
  }): Promise<ProviderMoneyState>;
}
