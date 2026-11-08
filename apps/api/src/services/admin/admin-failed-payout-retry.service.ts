import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { Payout } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { PayoutNotFoundError, PayoutStatusTransitionError } from "../interfaces/payout.js";
import type { IConnectTransferInitiator } from "../interfaces/stripe-connect.js";

export type FailedPayoutRetryOutcome =
  | { ok: true; payout: Payout }
  | { ok: false; reason: string; stripeErrorMessage?: string; message?: string };

/** Stripe may still be finishing the last attempt for this long after a payout failed. */
export const FAILED_PAYOUT_RETRY_COOL_OFF_MS = 5 * 60_000;
export const FAILED_PAYOUT_RETRY_TOO_SOON_MESSAGE =
  "Wait a few minutes: Stripe may still be finishing the last attempt";

/**
 * Lets staff send the Stripe transfer again for a payout whose transfer failed. The payout is
 * only picked up while it is failed, and it stays failed until Stripe accepts the new transfer,
 * so the settlement cron cannot send it at the same time. Each retry is recorded against the
 * person who asked for it before the transfer is attempted.
 */
export class AdminFailedPayoutRetryService {
  constructor(
    private readonly payouts: Pick<IPayoutRepository, "findById">,
    private readonly transfers: Pick<IConnectTransferInitiator, "initiateTransfer">,
    private readonly events: IDomainEventSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async retry(
    actorUserId: string,
    payoutId: string,
    reason: string,
  ): Promise<FailedPayoutRetryOutcome> {
    const payout = await this.payouts.findById(payoutId);
    if (!payout) throw new PayoutNotFoundError();
    if (payout.status !== "failed") {
      throw new PayoutStatusTransitionError("payout_not_failed");
    }
    // A failure Stripe is still settling can turn out to have a live transfer, so a retry right
    // after it could race that transfer. Nothing is recorded or sent until the cool-off is over.
    if (
      payout.processedAt &&
      this.now().getTime() - payout.processedAt.getTime() < FAILED_PAYOUT_RETRY_COOL_OFF_MS
    ) {
      return {
        ok: false,
        reason: "retry_too_soon",
        message: FAILED_PAYOUT_RETRY_TOO_SOON_MESSAGE,
      };
    }

    await this.events.publish({
      aggregateType: "payout",
      aggregateId: payout.id,
      eventType: "payout.transfer_retry_requested",
      payload: {
        legalEntityId: payout.legalEntityId,
        netAmount: payout.netAmount,
        currency: payout.currency,
        previousFailureReason: payout.failureReason,
        reason,
      },
      actorUserId,
      actingLegalEntityId: payout.legalEntityId,
    });

    const result = await this.transfers.initiateTransfer(payout.id, { retryFailed: true });
    if (!result.ok) {
      if (result.reason === "payout_already_processed") {
        throw new PayoutStatusTransitionError("payout_state_changed");
      }
      return {
        ok: false,
        reason: result.reason,
        ...(result.stripeErrorMessage ? { stripeErrorMessage: result.stripeErrorMessage } : {}),
      };
    }

    const updated = await this.payouts.findById(payout.id);
    if (!updated) throw new PayoutNotFoundError();
    return { ok: true, payout: updated };
  }
}
