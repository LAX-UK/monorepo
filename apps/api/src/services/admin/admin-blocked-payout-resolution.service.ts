import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { Payout } from "@auction/types";
import type { ResolveBlockedPayoutInput } from "@auction/validators";
import {
  type IPayoutAdminService,
  PayoutNotFoundError,
  PayoutStatusTransitionError,
} from "../interfaces/payout.js";
import type { IConnectTransferInitiator } from "../interfaces/stripe-connect.js";

export type BlockedPayoutRefusalReason =
  | "transfer_linked_to_other_payout"
  | "transfer_not_found"
  | "transfer_belongs_to_other_payout"
  | "transfer_not_for_this_payout"
  | "transfer_reversed"
  | "destination_mismatch"
  | "currency_mismatch"
  | "amount_mismatch"
  | "no_connect_account"
  | "stripe_not_configured"
  | "stripe_error";

export type BlockedPayoutResolutionOutcome =
  | { ok: true; payout: Payout }
  | { ok: false; reason: string; message: string };

/** What staff are told when a transfer cannot be adopted. */
const REFUSAL_MESSAGES: Record<string, string> = {
  transfer_linked_to_other_payout: "That Stripe transfer is already linked to another payout.",
  transfer_not_found: "Stripe has no transfer with that ID.",
  transfer_belongs_to_other_payout:
    "Stripe records that transfer against a different payout, so it cannot pay this one.",
  transfer_not_for_this_payout:
    "That transfer is not marked for this payout in Stripe (no matching transfer group or payout ID).",
  transfer_reversed: "That transfer has been reversed, in whole or in part, so it cannot be used.",
  destination_mismatch: "That transfer went to a different Stripe account than this seller's.",
  currency_mismatch: "That transfer is in a different currency from the payout.",
  amount_mismatch: "That transfer's amount is not the payout's net amount.",
  no_connect_account:
    "The seller has no Stripe account connected, so the transfer cannot be checked.",
  stripe_not_configured: "Stripe is not configured, so the transfer cannot be checked.",
  stripe_error: "Stripe could not be reached to check that transfer. Try again.",
};

function refusal(reason: string): BlockedPayoutResolutionOutcome {
  return {
    ok: false,
    reason,
    message: REFUSAL_MESSAGES[reason] ?? "That transfer cannot be used for this payout.",
  };
}

/**
 * The two ways staff get a `transfer_blocked` payout moving again. Adopting a transfer is checked
 * against Stripe first (account, currency, amount, not reversed, not linked elsewhere) and only
 * then moves the payout; releasing it to `failed` rests on staff confirming Stripe holds no live
 * transfer, and a later retry still looks at Stripe before it sends anything. Both moves happen
 * only if the payout is still blocked.
 */
export class AdminBlockedPayoutResolutionService {
  constructor(
    private readonly payouts: Pick<
      IPayoutAdminService,
      "adoptBlockedTransfer" | "releaseBlockedPayout"
    >,
    private readonly repo: Pick<IPayoutRepository, "findById" | "findByStripeTransferId">,
    private readonly transfers: Pick<IConnectTransferInitiator, "verifyTransferForAdoption">,
  ) {}

  async resolve(
    actorUserId: string,
    payoutId: string,
    input: ResolveBlockedPayoutInput,
  ): Promise<BlockedPayoutResolutionOutcome> {
    const payout = await this.repo.findById(payoutId);
    if (!payout) throw new PayoutNotFoundError();
    if (payout.status !== "transfer_blocked") {
      throw new PayoutStatusTransitionError("payout_not_blocked");
    }

    if (input.resolution === "release_to_failed") {
      const released = await this.payouts.releaseBlockedPayout(actorUserId, payoutId, {
        reason: input.reason,
        noLiveTransferConfirmed: input.noLiveTransferConfirmed,
      });
      return { ok: true, payout: released };
    }

    const linked = await this.repo.findByStripeTransferId(input.stripeTransferId);
    if (linked && linked.id !== payoutId) return refusal("transfer_linked_to_other_payout");

    const verified = await this.transfers.verifyTransferForAdoption(
      payoutId,
      input.stripeTransferId,
    );
    if (!verified.ok) return refusal(verified.reason);

    const adopted = await this.payouts.adoptBlockedTransfer(actorUserId, payoutId, {
      stripeTransferId: verified.stripeTransferId,
      reason: input.reason,
    });
    return { ok: true, payout: adopted };
  }
}
