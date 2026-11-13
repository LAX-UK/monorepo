import type { Database } from "@auction/db";
import {
  lastTransferOutcomeUnknown,
  transferFailureReason,
  transferOutcomeUnknownAfter,
} from "@auction/domain";
import type {
  IConnectTransferRepository,
  IPayoutRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import {
  type ConnectTransferBlockReason,
  checkTransferForAdoption,
  connectTransferBlockMessage,
  createConnectTransfer,
  decideConnectTransfer,
} from "@auction/stripe-connect";
import type { Payout } from "@auction/types";
import type { Logger } from "pino";
import type Stripe from "stripe";
import StripeSdk from "stripe";
import type { IDomainEventPublisher } from "../domain-event-publisher.js";
import { type IMoneyPathMetrics, noMoneyPathMetrics } from "../money-path-metrics.js";
import { payoutRepoForTx as defaultPayoutRepoForTx } from "../payout/payout-helpers.js";
import type {
  IConnectAccountReadinessSync,
  InitiateTransferOptions,
  InitiateTransferResult,
  TransferAdoptionVerification,
} from "../payout/types.js";
import { connectReadyFromCachedEntity } from "./connect-shared.js";
import type { IStripeClientFactory } from "./stripe-client-factory.js";
import { executeWithStripeRetries } from "./stripe-retries.js";

/**
 * Stripe replays the first answer for a key, including a failure, and refuses the key with other
 * parameters, so a retry needs a key of its own. It names the amount: a payout whose net changed
 * after a refused attempt sends the new net under a new key rather than being refused for 24h. It
 * is tied to the failure being retried: staff who retry the same failure share one key, and a later
 * failure gets a fresh one. A second transfer for the payout is prevented by
 * `decideConnectTransfer`, which looks at what Stripe already holds for it before any create.
 */
function transferIdempotencyKey(
  payout: { id: string; processedAt: Date | null },
  amountMinor: number,
  opts: InitiateTransferOptions | undefined,
): string {
  const base = `payout:transfer:${payout.id}:${amountMinor}`;
  return opts?.retryFailed ? `${base}:retry:${payout.processedAt?.getTime() ?? 0}` : base;
}

/**
 * The transaction each transfer step runs in. The step holds the payout row (`FOR UPDATE`) from
 * the moment it reads the amount until the payout has left `scheduled`, so a payout line written
 * meanwhile (which takes the same row lock) lands either before the amount is read, and is part
 * of the transfer, or after the payout has moved on, and goes to the seller's next payout.
 */
export type PayoutTransferTransactions = {
  runner: ITransactionRunner;
  payoutRepoForTx?: (rootRepo: IPayoutRepository, tx: Database) => IPayoutRepository;
};

/** What the locked transfer step did, reported once its transaction has committed. */
type TransferStep =
  | { kind: "already_processed" }
  | { kind: "blocked"; reason: ConnectTransferBlockReason; transferIds: string[] }
  | { kind: "initiated"; transferId: string; adopted: boolean }
  | { kind: "status_cas_miss"; transferId: string; current: Payout | null }
  | { kind: "stripe_failed"; errorCode: string; errorMessage: string };

type LockedStepRefusal = { ok: false; reason: "payout_already_processed" | "payout_changed" };

function amountMinorOf(netAmount: string): number {
  return Math.round(Number.parseFloat(netAmount) * 100);
}

/**
 * Initiates platform → seller Stripe Connect transfers for scheduled payouts. The one
 * implementation, used by the API (staff retry, adoption check) and the worker (settlement cron).
 */
export class ConnectTransferInitiationService {
  constructor(
    private readonly logger: Logger,
    private readonly connectTransferRepository: IConnectTransferRepository,
    readonly stripeFactory: IStripeClientFactory,
    private readonly accountSync: IConnectAccountReadinessSync,
    private readonly payoutRepository: IPayoutRepository | undefined,
    private readonly domainEventSink?: IDomainEventPublisher | null,
    private readonly metrics: IMoneyPathMetrics = noMoneyPathMetrics,
    private readonly transactions: PayoutTransferTransactions | null = null,
  ) {}

  /**
   * Runs one step of a transfer with the payout row locked, after checking that the payout is
   * still in the status the attempt started from and still owes the amount the attempt was
   * prepared for. A payout whose lines changed since it was read is refused and left as it is,
   * for the next attempt to pick up at its new amount.
   */
  private async withLockedPayout<T>(
    payoutId: string,
    expected: { status: string; netAmount: string },
    work: (repo: IPayoutRepository, locked: Payout) => Promise<T>,
  ): Promise<T | LockedStepRefusal> {
    const transactions = this.transactions;
    const rootRepo = this.payoutRepository;
    if (!transactions || !rootRepo) throw new Error("payout_transfer_transactions_not_configured");
    const repoForTx = transactions.payoutRepoForTx ?? defaultPayoutRepoForTx;
    return transactions.runner.runInTransaction(async (tx) => {
      const repo = repoForTx(rootRepo, tx as Database);
      const locked = await repo.findByIdForUpdate(payoutId);
      if (!locked || locked.status !== expected.status) {
        return { ok: false, reason: "payout_already_processed" } as const;
      }
      if (amountMinorOf(locked.netAmount) !== amountMinorOf(expected.netAmount)) {
        this.logger.warn(
          { payoutId, readNet: expected.netAmount, lockedNet: locked.netAmount },
          "payout_transfer_amount_changed",
        );
        this.metrics.record("payout_transfer_amount_changed");
        return { ok: false, reason: "payout_changed" } as const;
      }
      return work(repo, locked);
    });
  }

  private get stripe(): Stripe | null {
    return this.stripeFactory.get();
  }

  async initiateTransfer(
    payoutId: string,
    opts?: InitiateTransferOptions,
  ): Promise<InitiateTransferResult> {
    const stripe = this.stripe;
    if (!stripe) {
      return { ok: false, reason: "stripe_not_configured" };
    }
    if (!this.payoutRepository || !this.transactions) {
      return { ok: false, reason: "internal_misconfiguration" };
    }

    const payout = await this.payoutRepository.findById(payoutId);
    if (!payout) {
      return { ok: false, reason: "payout_not_found" };
    }

    const startStatus = opts?.retryFailed ? "failed" : "scheduled";
    if (payout.status !== startStatus) {
      return { ok: false, reason: "payout_already_processed" };
    }

    const expected = { status: startStatus, netAmount: payout.netAmount };
    const amountCents = amountMinorOf(payout.netAmount);
    if (amountCents < 0) {
      const moved1 = await this.withLockedPayout(payoutId, expected, (repo) =>
        repo.updateStatusIfCurrent(payoutId, startStatus, {
          status: "clawback_pending",
          stripeTransferId: null,
          processedAt: new Date(),
          failureReason: "negative_net_amount",
        }),
      );
      if (moved1 && "ok" in moved1) return moved1;
      if (!moved1) return { ok: false, reason: "payout_already_processed" };

      if (this.domainEventSink) {
        await this.domainEventSink.publish({
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
      this.metrics.record("payout_clawback_required");

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
        this.metrics.record("stripe_connect_sync_degraded");
        connectReady = connectReadyFromCachedEntity(entity);
      }
    }

    if (!connectReady) {
      if (this.domainEventSink) {
        await this.domainEventSink.publish({
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
      const moved2 = await this.withLockedPayout(payoutId, expected, (repo) =>
        repo.updateStatusIfCurrent(payoutId, startStatus, {
          status: "paid",
          stripeTransferId: null,
          processedAt: new Date(),
          failureReason: null,
        }),
      );
      if (moved2 && "ok" in moved2) return moved2;
      if (!moved2) return { ok: false, reason: "payout_already_processed" };
      return { ok: true, stripeTransferId: "zero_amount_skipped" };
    }

    const sourceChargeId = await this.resolveSourceTransaction(stripe, payoutId, payout.currency);
    const destinationAccountId = entity.stripeConnectAccountId;
    if (!destinationAccountId) {
      return { ok: false, reason: "no_connect_account" };
    }

    const transferGroup = `payout:${payoutId}`;
    // The amount is read again under the payout's row lock and the lock is held until the payout
    // has left its start status, so no payout line can change what is owed while the transfer for
    // it is being decided and created (see `withLockedPayout`).
    const step = await this.withLockedPayout(
      payoutId,
      expected,
      async (repo, locked): Promise<TransferStep> => {
        let createAttempted = false;
        try {
          // Stripe forgets idempotency keys after 24h, so a retry must look at what Stripe already
          // holds before it creates anything. One shared decision serves every caller.
          const decision = await executeWithStripeRetries(() =>
            decideConnectTransfer(stripe, {
              transferGroup,
              payoutId: payout.id,
              destinationAccountId,
              amountMinor: amountCents,
              currency: payout.currency,
              ...(payout.createdAt
                ? { createdAfterUnix: Math.floor(payout.createdAt.getTime() / 1000) }
                : {}),
            }),
          );
          if (decision.kind === "block") {
            const blocked = await repo.updateStatusIfCurrent(payoutId, startStatus, {
              status: "transfer_blocked",
              stripeTransferId: null,
              processedAt: null,
              failureReason: connectTransferBlockMessage(decision),
            });
            // Someone else moved the payout first: they own the outcome, so raise nothing.
            if (!blocked) return { kind: "already_processed" };
            return { kind: "blocked", reason: decision.reason, transferIds: decision.transferIds };
          }
          const adopted = decision.kind === "adopt";
          createAttempted = decision.kind !== "adopt";
          const transfer =
            decision.kind === "adopt"
              ? decision.transfer
              : await executeWithStripeRetries(() =>
                  createConnectTransfer(stripe, {
                    amountMinor: amountCents,
                    currency: payout.currency,
                    destinationAccountId,
                    transferGroup,
                    ...(sourceChargeId ? { sourceChargeId } : {}),
                    metadata: {
                      payoutId: payout.id,
                      legalEntityId: payout.legalEntityId,
                    },
                    idempotencyKey: transferIdempotencyKey(payout, amountCents, opts),
                  }),
                );

          const updated = await repo.updateStatusIfCurrent(payoutId, startStatus, {
            status: "in_transit",
            stripeTransferId: transfer.id,
            processedAt: null,
            failureReason: null,
          });
          if (!updated) {
            const current = await repo.findById(payoutId);
            return { kind: "status_cas_miss", transferId: transfer.id, current };
          }
          return { kind: "initiated", transferId: transfer.id, adopted };
        } catch (err) {
          if (!(err instanceof StripeSdk.errors.StripeError)) {
            throw err;
          }
          const errorCode = err.code ?? "unknown";
          const errorMessage = err.message ?? "Transfer failed after retries";
          // Stripe may hold a transfer for this amount when the create's outcome is unknown, or when
          // an earlier attempt's was and this one failed before it could find out. Such a payout
          // takes no new lines (`payoutTakesLines`) until an attempt settles what Stripe holds.
          const outcomeUnknown = createAttempted
            ? transferOutcomeUnknownAfter(err)
            : lastTransferOutcomeUnknown(locked);
          const moved3 = await repo.updateStatusIfCurrent(payoutId, startStatus, {
            status: opts?.keepScheduledOnTransferFailure ? "scheduled" : "failed",
            stripeTransferId: null,
            processedAt: opts?.keepScheduledOnTransferFailure ? null : new Date(),
            failureReason: transferFailureReason({ outcomeUnknown, errorCode, errorMessage }),
          });
          if (!moved3) return { kind: "already_processed" };
          return { kind: "stripe_failed", errorCode, errorMessage };
        }
      },
    );

    // Events go out once the payout's new status is committed.
    if ("ok" in step) return step;
    switch (step.kind) {
      case "already_processed":
        return { ok: false, reason: "payout_already_processed" };
      case "blocked": {
        this.logger.error(
          { payoutId, reason: step.reason, transferIds: step.transferIds },
          "payout_transfer_blocked",
        );
        this.metrics.record("payout_transfer_blocked");
        if (this.domainEventSink) {
          await this.domainEventSink.publish({
            aggregateType: "payout",
            aggregateId: payoutId,
            eventType: "payout.transfer_blocked",
            payload: {
              payoutId,
              legalEntityId: payout.legalEntityId,
              reason: step.reason,
            },
            actorUserId: null,
            actingLegalEntityId: payout.legalEntityId,
          });
        }
        return { ok: false, reason: "transfer_blocked" };
      }
      case "status_cas_miss": {
        const current = step.current;
        if (current?.status === "paid" || current?.status === "in_transit") {
          return {
            ok: true,
            stripeTransferId: current.stripeTransferId ?? step.transferId,
          };
        }
        this.metrics.record("payout_transfer_status_cas_miss");
        this.logger.error(
          { payoutId, stripeTransferId: step.transferId, currentStatus: current?.status ?? null },
          "payout_transfer_status_cas_miss",
        );
        return {
          ok: false,
          reason: "internal_misconfiguration",
          stripeErrorCode: "payout_transfer_status_cas_miss",
          stripeErrorMessage: `Transfer ${step.transferId} created but payout status is ${current?.status ?? "unknown"}`,
        };
      }
      case "stripe_failed": {
        if (this.domainEventSink) {
          await this.domainEventSink.publish({
            aggregateType: "payout",
            aggregateId: payoutId,
            eventType: "payout.transfer_failed",
            payload: {
              legalEntityId: payout.legalEntityId,
              stripeErrorCode: step.errorCode,
              stripeErrorMessage: step.errorMessage,
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
          stripeErrorCode: step.errorCode,
          stripeErrorMessage: step.errorMessage,
        };
      }
      case "initiated": {
        if (step.adopted) {
          this.logger.warn(
            { payoutId, stripeTransferId: step.transferId },
            "payout_transfer_adopted_existing",
          );
        }
        if (this.domainEventSink) {
          await this.domainEventSink.publish({
            aggregateType: "payout",
            aggregateId: payoutId,
            eventType: "payout.transfer_initiated",
            payload: {
              legalEntityId: payout.legalEntityId,
              stripeTransferId: step.transferId,
              amountCents,
              currency: payout.currency,
              stripeConnectAccountId: entity.stripeConnectAccountId,
              ...(step.adopted ? { adopted: true, adoptionSource: "stripe_transfer_group" } : {}),
            },
            actorUserId: null,
            actingLegalEntityId: payout.legalEntityId,
          });
        }
        return { ok: true, stripeTransferId: step.transferId };
      }
    }
  }

  /**
   * Fetches the transfer staff name from Stripe and checks it against the payout: same
   * destination account, same currency, same amount, not reversed. Changes nothing.
   */
  async verifyTransferForAdoption(
    payoutId: string,
    stripeTransferId: string,
  ): Promise<TransferAdoptionVerification> {
    const stripe = this.stripe;
    if (!stripe) return { ok: false, reason: "stripe_not_configured" };
    if (!this.payoutRepository) return { ok: false, reason: "internal_misconfiguration" };
    const payout = await this.payoutRepository.findById(payoutId);
    if (!payout) return { ok: false, reason: "payout_not_found" };
    const entity = await this.connectTransferRepository.findLegalEntityById(payout.legalEntityId);
    if (!entity?.stripeConnectAccountId) return { ok: false, reason: "no_connect_account" };

    let transfer: Stripe.Transfer;
    try {
      transfer = await executeWithStripeRetries(() => stripe.transfers.retrieve(stripeTransferId));
    } catch (err) {
      if (!(err instanceof StripeSdk.errors.StripeError)) throw err;
      return {
        ok: false,
        reason: err.code === "resource_missing" ? "transfer_not_found" : "stripe_error",
      };
    }
    const check = checkTransferForAdoption(transfer, {
      payoutId: payout.id,
      payoutCreatedAtUnix: Math.floor(payout.createdAt.getTime() / 1000),
      destinationAccountId: entity.stripeConnectAccountId,
      currency: payout.currency,
      amountMinor: Math.round(Number.parseFloat(payout.netAmount) * 100),
    });
    return check.ok ? { ok: true, stripeTransferId: transfer.id } : check;
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
        this.metrics.record("stripe_connect_transfer_currency_mismatch");
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
