import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../../lib/stripe-processed-event.js";
import type { IPayoutMaintenanceService } from "../../interfaces/payout.js";
import {
  TRANSFER_EVENT_TYPES,
  stripeFeeFromTransfer,
  transferStatusFromEvent,
} from "./connect-transfer-shared.js";

/** Reconciles Stripe transfer webhooks into payout ledger state. */
export class ConnectTransferWebhookService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly payoutService: IPayoutMaintenanceService,
  ) {}

  async handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    const eventType = event.type as string;
    if (!TRANSFER_EVENT_TYPES.has(eventType)) {
      return { processed: false };
    }

    const transfer = event.data.object as Stripe.Transfer;
    const isReversal = eventType === "transfer.reversed";
    const isMetadataOnly = eventType === "transfer.updated";

    return this.transactionRunner.runInTransaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        "stripe_connect_transfer",
      );
      if (!claimed) {
        return { processed: true };
      }

      if (isMetadataOnly) {
        return { processed: true };
      }

      const reconciled = await this.payoutService.reconcileStripeTransfer({
        stripeTransferId: transfer.id,
        payoutId: transfer.metadata?.payoutId,
        status: transferStatusFromEvent(eventType),
        stripeFee: stripeFeeFromTransfer(transfer),
        failureReason: transfer.metadata?.failureReason ?? null,
        occurredAt: transfer.created ? new Date(transfer.created * 1000) : new Date(),
        ...(isReversal
          ? {
              stripeEventId: event.id,
              reversedAmountCents: transfer.amount_reversed ?? transfer.amount,
            }
          : {}),
      });
      return { processed: reconciled !== null };
    });
  }
}
