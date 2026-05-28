import type { Database } from "@auction/db";
import { legalEntity, payment } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import StripeSdk from "stripe";
import type { Env } from "../../../env.js";
import { type AppLogger, createBaseLogger } from "../../../lib/logger.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../../middleware/metrics.js";
import type { DomainEventPublisher } from "../../domain-event.publisher.js";
import type { IPayoutRepository } from "../../interfaces/payout-repository.js";
import type { IPayoutService } from "../../interfaces/payout.js";
import type { InitiateTransferResult } from "../../interfaces/stripe-connect.js";
import type { ConnectAccountService } from "./connect-account.service.js";

const TRANSFER_EVENT_TYPES = new Set(["transfer.created", "transfer.updated", "transfer.reversed"]);

function transferStatusFromEvent(eventType: string): "paid" | "reversed" {
  if (eventType === "transfer.reversed") return "reversed";
  return "paid";
}

function stripeFeeFromTransfer(transfer: Stripe.Transfer): string | undefined {
  const balanceTransaction = transfer.balance_transaction;
  if (!balanceTransaction || typeof balanceTransaction === "string") return undefined;
  const fee = balanceTransaction.fee;
  return typeof fee === "number" ? (fee / 100).toFixed(2) : undefined;
}

export class ConnectTransferService {
  private readonly logger: AppLogger;

  constructor(
    env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">,
    private readonly db: Database,
    private readonly stripeFactory: IStripeClientFactory,
    private readonly accountService: ConnectAccountService,
    private readonly payoutService: IPayoutService,
    private readonly payoutRepository?: IPayoutRepository,
    private readonly domainEventPublisher?: DomainEventPublisher,
  ) {
    this.logger = createBaseLogger(env);
  }

  private get stripe(): Stripe | null {
    return this.stripeFactory.get();
  }

  async handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    const eventType = event.type as string;
    if (!TRANSFER_EVENT_TYPES.has(eventType)) {
      return { processed: false };
    }

    const transfer = event.data.object as Stripe.Transfer;
    const isReversal = eventType === "transfer.reversed";
    const isMetadataOnly = eventType === "transfer.updated";

    return this.db.transaction(async (tx) => {
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

  async initiateTransfer(
    payoutId: string,
    opts?: { keepScheduledOnTransferFailure?: boolean },
  ): Promise<InitiateTransferResult> {
    const stripe = this.stripe;
    if (!stripe) {
      return { ok: false, reason: "stripe_not_configured" };
    }
    if (!this.payoutRepository) {
      return { ok: false, reason: "internal_misconfiguration" };
    }

    const payout = await this.payoutRepository.findById(payoutId);
    if (!payout) {
      return { ok: false, reason: "payout_not_found" };
    }

    if (payout.status !== "scheduled") {
      return { ok: false, reason: "payout_already_processed" };
    }

    const amountCents = Math.round(Number.parseFloat(payout.netAmount) * 100);
    if (amountCents < 0) {
      await this.payoutRepository.updateStatus(payoutId, {
        status: "clawback_pending",
        stripeTransferId: null,
        processedAt: new Date(),
        failureReason: "negative_net_amount",
      });

      if (this.domainEventPublisher) {
        await this.domainEventPublisher.publish(this.db, {
          aggregateType: "payout",
          aggregateId: payoutId,
          eventType: "payout.clawback_required",
          payload: {
            payoutId,
            legalEntityId: payout.legalEntityId,
            netAmount: payout.netAmount,
            currency: payout.currency,
            reason: "negative_net_amount",
          },
          actorUserId: null,
          actingLegalEntityId: payout.legalEntityId,
        });
      }
      recordMoneyPathEvent("payout_clawback_required");

      return { ok: false, reason: "negative_net_amount" };
    }

    const rows = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, payout.legalEntityId))
      .limit(1);
    const entity = rows[0];
    if (!entity) {
      return { ok: false, reason: "entity_not_found" };
    }
    if (!entity.stripeConnectAccountId) {
      return { ok: false, reason: "no_connect_account" };
    }

    let connectReady = false;
    if (this.stripe) {
      try {
        const live = await this.accountService.syncAccountFromStripe(payout.legalEntityId);
        connectReady = live.ready;
      } catch (err) {
        this.logger.warn(
          {
            legalEntityId: payout.legalEntityId,
            payoutId,
            err: err instanceof Error ? err.message : String(err),
          },
          "stripe_connect_sync_degraded",
        );
        recordMoneyPathEvent("stripe_connect_sync_degraded");
        connectReady =
          entity.stripeConnectPayoutsEnabled &&
          (entity.stripeConnectRequirementsCurrentlyDue ?? []).length === 0;
      }
    }

    if (!connectReady) {
      if (this.domainEventPublisher) {
        await this.domainEventPublisher.publish(this.db, {
          aggregateType: "payout",
          aggregateId: payoutId,
          eventType: "payout.transfer_blocked",
          payload: {
            payoutId,
            legalEntityId: payout.legalEntityId,
            reason: "connect_not_ready",
          },
          actorUserId: null,
          actingLegalEntityId: payout.legalEntityId,
        });
      }
      return { ok: false, reason: "connect_not_ready" };
    }

    if (amountCents <= 0) {
      await this.payoutRepository.updateStatus(payoutId, {
        status: "paid",
        stripeTransferId: null,
        processedAt: new Date(),
        failureReason: null,
      });
      return { ok: true, stripeTransferId: "zero_amount_skipped" };
    }

    const maxRetries = 3;
    let lastError: InstanceType<typeof Stripe.errors.StripeError> | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const sourceChargeId = await this.findSourceChargeForPayout(payoutId);
        const transfer = await stripe.transfers.create(
          {
            amount: amountCents,
            currency: payout.currency.toLowerCase(),
            destination: entity.stripeConnectAccountId,
            transfer_group: `payout:${payoutId}`,
            ...(sourceChargeId ? { source_transaction: sourceChargeId } : {}),
            metadata: {
              payoutId: payout.id,
              legalEntityId: payout.legalEntityId,
            },
          },
          { idempotencyKey: `payout:transfer:${payoutId}` },
        );

        await this.payoutRepository.updateStatus(payoutId, {
          status: "in_transit",
          stripeTransferId: transfer.id,
          processedAt: null,
          failureReason: null,
        });

        if (this.domainEventPublisher) {
          await this.domainEventPublisher.publish(this.db, {
            aggregateType: "payout",
            aggregateId: payoutId,
            eventType: "payout.transfer_initiated",
            payload: {
              legalEntityId: payout.legalEntityId,
              stripeTransferId: transfer.id,
              amountCents,
              currency: payout.currency,
              stripeConnectAccountId: entity.stripeConnectAccountId,
            },
            actorUserId: null,
            actingLegalEntityId: payout.legalEntityId,
          });
        }

        return { ok: true, stripeTransferId: transfer.id };
      } catch (err) {
        if (err instanceof StripeSdk.errors.StripeError) {
          lastError = err;
          const isRetryable =
            err.type === "StripeConnectionError" ||
            err.type === "StripeAPIError" ||
            (err.type === "StripeRateLimitError" && attempt < maxRetries);

          if (isRetryable && attempt < maxRetries) {
            const delayMs = 2 ** attempt * 1000;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } else {
          throw err;
        }
      }
    }

    const errorCode = lastError?.code ?? "unknown";
    const errorMessage = lastError?.message ?? "Transfer failed after retries";
    const failureReason = `stripe_transfer_failed: ${errorCode} - ${errorMessage}`;

    await this.payoutRepository.updateStatus(payoutId, {
      status: opts?.keepScheduledOnTransferFailure ? "scheduled" : "failed",
      stripeTransferId: null,
      processedAt: opts?.keepScheduledOnTransferFailure ? null : new Date(),
      failureReason,
    });

    if (this.domainEventPublisher) {
      await this.domainEventPublisher.publish(this.db, {
        aggregateType: "payout",
        aggregateId: payoutId,
        eventType: "payout.transfer_failed",
        payload: {
          legalEntityId: payout.legalEntityId,
          stripeErrorCode: errorCode,
          stripeErrorMessage: errorMessage,
          amountCents,
          currency: payout.currency,
        },
        actorUserId: null,
        actingLegalEntityId: payout.legalEntityId,
      });
    }

    return {
      ok: false,
      reason: "stripe_error",
      stripeErrorCode: errorCode,
      stripeErrorMessage: errorMessage,
    };
  }

  private async findSourceChargeForPayout(payoutId: string): Promise<string | null> {
    if (!this.payoutRepository) return null;
    const lines = await this.payoutRepository.listLines(payoutId);
    const saleLine = lines.find((line) => line.kind === "sale" && line.paymentId);
    if (!saleLine?.paymentId) return null;
    const rows = await this.db
      .select({ stripeChargeId: payment.stripeChargeId })
      .from(payment)
      .where(eq(payment.id, saleLine.paymentId))
      .limit(1);
    const chargeId = rows[0]?.stripeChargeId;
    return chargeId && chargeId.length > 0 ? chargeId : null;
  }
}
