import type { Database } from "@auction/db";
import { legalEntity, user } from "@auction/db/schema";
import type { LegalEntity } from "@auction/types";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import type { Env } from "../../env.js";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { StripeClientFactory } from "../../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";
import type { IPayoutService } from "../interfaces/payout.js";
import {
  type AccountLink,
  type ConnectAccountStatus,
  type CreateAccountResult,
  type IStripeConnectService,
  type InitiateTransferResult,
  StripeConnectNotConfiguredError,
} from "../interfaces/stripe-connect.js";

function rowToEntity(row: typeof legalEntity.$inferSelect): LegalEntity {
  return {
    id: row.id,
    displayName: row.displayName,
    legalName: row.legalName ?? null,
    slug: row.slug ?? null,
    kind: row.kind,
    subkind: row.subkind,
    createdByUserId: row.createdByUserId,
    status: row.status,
    statusChangedAt: row.statusChangedAt ?? null,
    statusChangedByUserId: row.statusChangedByUserId ?? null,
    stripeConnectAccountId: row.stripeConnectAccountId ?? null,
    stripeConnectChargesEnabled: row.stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled: row.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue ?? [],
    stripeConnectDisabledReason: row.stripeConnectDisabledReason ?? null,
    xeroContactId: row.xeroContactId ?? null,
    vatNumber: row.vatNumber ?? null,
    marginSchemeEligible: row.marginSchemeEligible,
    isLaxManaged: row.isLaxManaged,
    platformFeeBps: row.platformFeeBps ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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

const TRANSFER_EVENT_TYPES = new Set(["transfer.created", "transfer.updated", "transfer.reversed"]);

export class StripeConnectService implements IStripeConnectService {
  private readonly stripeFactory: IStripeClientFactory;
  private readonly webhookSecret: string | undefined;

  constructor(
    env: Env,
    private readonly db: Database,
    private readonly payoutService: IPayoutService,
    private readonly payoutRepository?: IPayoutRepository,
    private readonly domainEventPublisher?: DomainEventPublisher,
    stripeFactory?: IStripeClientFactory,
  ) {
    this.webhookSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET;
    this.stripeFactory = stripeFactory ?? new StripeClientFactory(env);
  }

  private get stripe(): Stripe | null {
    return this.stripeFactory.get();
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) throw new StripeConnectNotConfiguredError();
    return this.stripe;
  }

  private async loadEntity(id: string) {
    const rows = await this.db.select().from(legalEntity).where(eq(legalEntity.id, id)).limit(1);
    const row = rows[0];
    if (!row) throw new Error("legal_entity_not_found");
    return row;
  }

  /** Legal entity row plus owner user fields (Connect onboarding needs human identity for individuals). */
  private async loadLegalEntityWithOwner(legalEntityId: string) {
    const rows = await this.db
      .select({
        entity: legalEntity,
        ownerEmail: user.email,
        ownerFirstName: user.firstName,
        ownerLastName: user.lastName,
        ownerDisplayName: user.name,
      })
      .from(legalEntity)
      .innerJoin(user, eq(user.id, legalEntity.createdByUserId))
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error("legal_entity_not_found");
    return row;
  }

  async ensureAccount(legalEntityId: string, country: string): Promise<CreateAccountResult> {
    const stripe = this.requireStripe();
    const {
      entity: row,
      ownerEmail,
      ownerFirstName,
      ownerLastName,
      ownerDisplayName,
    } = await this.loadLegalEntityWithOwner(legalEntityId);
    if (row.stripeConnectAccountId) {
      return { stripeAccountId: row.stripeConnectAccountId, legalEntity: rowToEntity(row) };
    }

    const accountCreateParams: Stripe.AccountCreateParams =
      row.kind === "organisation"
        ? {
            type: "express",
            country,
            capabilities: {
              transfers: { requested: true },
            },
            business_type: row.subkind === "charity" ? "non_profit" : "company",
            metadata: { legalEntityId, subkind: row.subkind },
            ...(row.legalName ? { business_profile: { name: row.legalName } } : {}),
          }
        : (() => {
            const display = ownerDisplayName?.trim() || "";
            const parts = display.split(/\s+/).filter(Boolean);
            const fromDisplay = parts.length > 0 ? parts[0] : undefined;
            const fromEmail = ownerEmail.split("@")[0];
            const first =
              ownerFirstName?.trim() ||
              fromDisplay ||
              (fromEmail !== "" ? fromEmail : undefined) ||
              "Seller";
            const last =
              ownerLastName?.trim() ||
              (parts.length > 1 ? parts.slice(1).join(" ") : "") ||
              first ||
              "Individual";
            return {
              type: "express" as const,
              country,
              capabilities: {
                transfers: { requested: true },
              },
              business_type: "individual" as const,
              individual: {
                first_name: first.slice(0, 100),
                last_name: last.slice(0, 100),
                email: ownerEmail,
              },
              metadata: { legalEntityId, subkind: row.subkind },
            };
          })();

    const account = await stripe.accounts.create(accountCreateParams, {
      idempotencyKey: `connect:account:${legalEntityId}`,
    });

    const [updated] = await this.db
      .update(legalEntity)
      .set({
        stripeConnectAccountId: account.id,
        status: row.status === "lead" ? "connect_pending" : row.status,
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(legalEntity.id, legalEntityId))
      .returning();
    if (!updated) throw new Error("legal_entity_update_failed");

    return { stripeAccountId: account.id, legalEntity: rowToEntity(updated) };
  }

  async getStatus(legalEntityId: string): Promise<ConnectAccountStatus> {
    const row = await this.loadEntity(legalEntityId);
    if (!row.stripeConnectAccountId) {
      return {
        stripeAccountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsCurrentlyDue: [],
        disabledReason: null,
        ready: false,
      };
    }
    return {
      stripeAccountId: row.stripeConnectAccountId,
      chargesEnabled: row.stripeConnectChargesEnabled,
      payoutsEnabled: row.stripeConnectPayoutsEnabled,
      requirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue ?? [],
      disabledReason: row.stripeConnectDisabledReason ?? null,
      ready:
        row.stripeConnectChargesEnabled &&
        row.stripeConnectPayoutsEnabled &&
        (row.stripeConnectRequirementsCurrentlyDue ?? []).length === 0,
    };
  }

  async createOnboardingLink(
    legalEntityId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<AccountLink> {
    const stripe = this.requireStripe();
    const row = await this.loadEntity(legalEntityId);
    if (!row.stripeConnectAccountId) {
      throw new Error("stripe_account_missing");
    }
    const link = await stripe.accountLinks.create({
      account: row.stripeConnectAccountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
  }

  async createDashboardLink(legalEntityId: string): Promise<AccountLink> {
    const stripe = this.requireStripe();
    const row = await this.loadEntity(legalEntityId);
    if (!row.stripeConnectAccountId) throw new Error("stripe_account_missing");
    const link = await stripe.accounts.createLoginLink(row.stripeConnectAccountId);
    // Login links expire in ~5 minutes; conservatively report 5 minutes.
    return { url: link.url, expiresAt: new Date(Date.now() + 5 * 60 * 1000) };
  }

  async handleWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<{ processed: boolean }> {
    if (!this.stripe) throw new StripeConnectNotConfiguredError();
    if (!this.webhookSecret) throw new StripeConnectNotConfiguredError();
    if (!signature) throw new Error("missing_stripe_signature");

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);

    if (TRANSFER_EVENT_TYPES.has(event.type as string)) {
      return this.handleTransferEvent(event);
    }
    return this.handleConnectedAccountEvent(event);
  }

  async handleConnectedAccountEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      return this.db.transaction(async (tx) => {
        const { claimed } = await tryClaimProcessedStripeEvent(tx, event.id, "stripe_connect");
        if (!claimed) {
          return { processed: true };
        }
        await this.applyAccountUpdate(account, tx);
        return { processed: true };
      });
    }
    if (event.type === "capability.updated") {
      const cap = event.data.object as Stripe.Capability;
      const accountId = typeof cap.account === "string" ? cap.account : cap.account?.id;
      if (!accountId) {
        return { processed: false };
      }
      return this.db.transaction(async (tx) => {
        const { claimed } = await tryClaimProcessedStripeEvent(tx, event.id, "stripe_connect");
        if (!claimed) {
          return { processed: true };
        }
        const stripe = this.requireStripe();
        const account = await stripe.accounts.retrieve(accountId);
        await this.applyAccountUpdate(account, tx);
        return { processed: true };
      });
    }
    return { processed: false };
  }

  async handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    const eventType = event.type as string;
    if (!TRANSFER_EVENT_TYPES.has(eventType)) {
      return { processed: false };
    }

    const transfer = event.data.object as Stripe.Transfer;
    const isReversal = eventType === "transfer.reversed";
    // `transfer.updated` fires when description/metadata change on an already-
    // settled transfer. We dedup the event but do not change payout status,
    // so a late `transfer.updated` can never undo a prior `transfer.reversed`.
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

  private async applyAccountUpdate(account: Stripe.Account, db: Database = this.db): Promise<void> {
    const requirementsCurrentlyDue = (account.requirements?.currently_due ?? []) as string[];
    const disabledReason =
      typeof account.requirements?.disabled_reason === "string"
        ? account.requirements.disabled_reason
        : null;
    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = Boolean(account.payouts_enabled);

    const rows = await db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.stripeConnectAccountId, account.id))
      .limit(1);
    const row = rows[0];
    if (!row) return;

    const isReady = chargesEnabled && payoutsEnabled && requirementsCurrentlyDue.length === 0;
    const nextStatus = isReady && row.status === "connect_pending" ? "approved" : row.status;

    await db
      .update(legalEntity)
      .set({
        stripeConnectChargesEnabled: chargesEnabled,
        stripeConnectPayoutsEnabled: payoutsEnabled,
        stripeConnectRequirementsCurrentlyDue: requirementsCurrentlyDue,
        stripeConnectDisabledReason: disabledReason,
        ...(nextStatus !== row.status ? { status: nextStatus, statusChangedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(legalEntity.id, row.id));

    if (
      this.domainEventPublisher &&
      nextStatus === "approved" &&
      row.status === "connect_pending"
    ) {
      await this.domainEventPublisher.publish(db, {
        aggregateType: "legal_entity",
        aggregateId: row.id as string,
        eventType: "legal_entity.lifecycle_progressed",
        payload: {
          kind: row.kind,
          from_status: "connect_pending",
          to_status: "approved",
          reason: "stripe_connect_ready",
          stripeAccountId: account.id,
        },
        actorUserId: null,
        actingLegalEntityId: row.id as string,
      });
    }
  }

  /** Initiate a Stripe Connect transfer for a settled payout.
   * Retries up to 3 times with exponential backoff on transient errors.
   */
  async initiateTransfer(
    payoutId: string,
    opts?: { keepScheduledOnTransferFailure?: boolean },
  ): Promise<InitiateTransferResult> {
    const stripe = this.stripe;
    if (!stripe) {
      return { ok: false, reason: "stripe_not_configured" };
    }
    if (!this.payoutRepository) {
      return { ok: false, reason: "stripe_not_configured" };
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
    if (!entity.stripeConnectPayoutsEnabled) {
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
        const transfer = await stripe.transfers.create(
          {
            amount: amountCents,
            currency: payout.currency.toLowerCase(),
            destination: entity.stripeConnectAccountId,
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
        if (err instanceof Stripe.errors.StripeError) {
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
}
