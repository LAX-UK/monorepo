import type { Database } from "@auction/db";
import type { IConnectTransferRepository } from "@auction/persistence";
import type Stripe from "stripe";
import StripeSdk from "stripe";
import type { Env } from "../../../env.js";
import { type AppLogger, createBaseLogger } from "../../../lib/logger.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../../lib/stripe-retries.js";
import { recordMoneyPathEvent } from "../../../middleware/metrics.js";
import type { DomainEventPublisher } from "../../domain-event.publisher.js";
import type { IPayoutRepository } from "../../interfaces/payout-repository.js";
import type {
  IConnectAccountReadinessSync,
  IConnectTransferInitiationService,
  InitiateTransferResult,
} from "../../interfaces/stripe-connect.js";
import { connectReadyFromCachedEntity } from "./connect-shared.js";

/** Initiates platform → seller Stripe Connect transfers for scheduled payouts. */
export class ConnectTransferInitiationService implements IConnectTransferInitiationService {
  private readonly logger: AppLogger;

  constructor(
    env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">,
    private readonly db: Database,
    private readonly connectTransferRepository: IConnectTransferRepository,
    readonly stripeFactory: IStripeClientFactory,
    private readonly accountSync: IConnectAccountReadinessSync,
    private readonly payoutRepository: IPayoutRepository | undefined,
    private readonly domainEventPublisher?: DomainEventPublisher,
  ) {
    this.logger = createBaseLogger(env);
  }

  private get stripe(): Stripe | null {
    return this.stripeFactory.get();
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

    const entity = await this.connectTransferRepository.findLegalEntityById(payout.legalEntityId);
    if (!entity) {
      return { ok: false, reason: "entity_not_found" };
    }
    if (!entity.stripeConnectAccountId) {
      return { ok: false, reason: "no_connect_account" };
    }

    let connectReady = false;
    if (this.stripe) {
      try {
        const live = await this.accountSync.syncAccountFromStripe(payout.legalEntityId);
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
        connectReady = connectReadyFromCachedEntity(entity);
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

    const sourceChargeId = await this.resolveSourceTransaction(stripe, payoutId, payout.currency);
    const destinationAccountId = entity.stripeConnectAccountId;
    if (!destinationAccountId) {
      return { ok: false, reason: "no_connect_account" };
    }

    try {
      const transfer = await executeWithStripeRetries(() =>
        stripe.transfers.create(
          {
            amount: amountCents,
            currency: payout.currency.toLowerCase(),
            destination: destinationAccountId,
            transfer_group: `payout:${payoutId}`,
            ...(sourceChargeId ? { source_transaction: sourceChargeId } : {}),
            metadata: {
              payoutId: payout.id,
              legalEntityId: payout.legalEntityId,
            },
          },
          { idempotencyKey: `payout:transfer:${payoutId}` },
        ),
      );

      const updated = await this.payoutRepository.updateStatusIfCurrent(payoutId, "scheduled", {
        status: "in_transit",
        stripeTransferId: transfer.id,
        processedAt: null,
        failureReason: null,
      });

      if (!updated) {
        const current = await this.payoutRepository.findById(payoutId);
        if (current?.status === "paid" || current?.status === "in_transit") {
          return {
            ok: true,
            stripeTransferId: current.stripeTransferId ?? transfer.id,
          };
        }
        recordMoneyPathEvent("payout_transfer_status_cas_miss");
        this.logger.error(
          { payoutId, stripeTransferId: transfer.id, currentStatus: current?.status ?? null },
          "payout_transfer_status_cas_miss",
        );
        return {
          ok: false,
          reason: "internal_misconfiguration",
          stripeErrorCode: "payout_transfer_status_cas_miss",
          stripeErrorMessage: `Transfer ${transfer.id} created but payout status is ${current?.status ?? "unknown"}`,
        };
      }

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
      if (!(err instanceof StripeSdk.errors.StripeError)) {
        throw err;
      }

      const errorCode = err.code ?? "unknown";
      const errorMessage = err.message ?? "Transfer failed after retries";
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
  }

  private async findSourceChargeForPayout(payoutId: string): Promise<string | null> {
    if (!this.payoutRepository) return null;
    const lines = await this.payoutRepository.listLines(payoutId);
    const saleLine = lines.find((line) => line.kind === "sale" && line.paymentId);
    if (!saleLine?.paymentId) return null;
    return this.connectTransferRepository.findStripeChargeIdByPaymentId(saleLine.paymentId);
  }

  private async resolveSourceTransaction(
    stripe: Stripe,
    payoutId: string,
    payoutCurrency: string,
  ): Promise<string | undefined> {
    const sourceChargeId = await this.findSourceChargeForPayout(payoutId);
    if (!sourceChargeId) return undefined;

    try {
      const charge = await stripe.charges.retrieve(sourceChargeId);
      const chargeCurrency = charge.currency?.toLowerCase();
      const expectedCurrency = payoutCurrency.toLowerCase();
      if (chargeCurrency && chargeCurrency !== expectedCurrency) {
        this.logger.warn(
          {
            payoutId,
            sourceChargeId,
            chargeCurrency,
            payoutCurrency: expectedCurrency,
          },
          "stripe_connect_transfer_currency_mismatch",
        );
        recordMoneyPathEvent("stripe_connect_transfer_currency_mismatch");
        return undefined;
      }
      return sourceChargeId;
    } catch (err) {
      this.logger.warn(
        {
          payoutId,
          sourceChargeId,
          err: err instanceof Error ? err.message : String(err),
        },
        "stripe_connect_source_charge_lookup_failed",
      );
      return undefined;
    }
  }
}
