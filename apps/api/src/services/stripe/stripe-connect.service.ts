import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import type { LegalEntity, Payout } from "@auction/types";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import type { Env } from "../../env.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPayoutService } from "../interfaces/payout.js";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";
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
    xeroContactId: row.xeroContactId ?? null,
    vatNumber: row.vatNumber ?? null,
    marginSchemeEligible: row.marginSchemeEligible,
    isLaxManaged: row.isLaxManaged,
    platformFeeBps: row.platformFeeBps ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function transferStatusFromEvent(eventType: string): "created" | "paid" | "failed" | "reversed" {
  if (eventType === "transfer.paid") return "paid";
  if (eventType === "transfer.failed") return "failed";
  if (eventType === "transfer.reversed") return "reversed";
  return "created";
}

function stripeFeeFromTransfer(transfer: Stripe.Transfer): string | undefined {
  const balanceTransaction = transfer.balance_transaction;
  if (!balanceTransaction || typeof balanceTransaction === "string") return undefined;
  const fee = balanceTransaction.fee;
  return typeof fee === "number" ? (fee / 100).toFixed(2) : undefined;
}

export class StripeConnectService implements IStripeConnectService {
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(
    private readonly env: Env,
    private readonly db: Database,
    private readonly payoutService: IPayoutService,
    private readonly payoutRepository?: IPayoutRepository,
    private readonly domainEventPublisher?: DomainEventPublisher,
  ) {
    this.webhookSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET;
    this.stripe = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, { typescript: true })
      : null;
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  private async loadEntity(id: string) {
    const rows = await this.db.select().from(legalEntity).where(eq(legalEntity.id, id)).limit(1);
    const row = rows[0];
    if (!row) throw new Error("legal_entity_not_found");
    return row;
  }

  async ensureAccount(legalEntityId: string, country: string): Promise<CreateAccountResult> {
    if (!this.stripe) throw new StripeConnectNotConfiguredError();
    const row = await this.loadEntity(legalEntityId);
    if (row.kind !== "organisation") {
      throw new Error("connect_only_for_organisations");
    }
    if (row.stripeConnectAccountId) {
      return { stripeAccountId: row.stripeConnectAccountId, legalEntity: rowToEntity(row) };
    }

    const account = await this.stripe.accounts.create({
      type: "express",
      country,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: row.subkind === "charity" ? "non_profit" : "company",
      metadata: { legalEntityId, subkind: row.subkind },
      ...(row.legalName ? { business_profile: { name: row.legalName } } : {}),
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
        ready: false,
      };
    }
    return {
      stripeAccountId: row.stripeConnectAccountId,
      chargesEnabled: row.stripeConnectChargesEnabled,
      payoutsEnabled: row.stripeConnectPayoutsEnabled,
      requirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue ?? [],
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
    if (!this.stripe) throw new StripeConnectNotConfiguredError();
    const row = await this.loadEntity(legalEntityId);
    if (!row.stripeConnectAccountId) {
      throw new Error("stripe_account_missing");
    }
    const link = await this.stripe.accountLinks.create({
      account: row.stripeConnectAccountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
  }

  async createDashboardLink(legalEntityId: string): Promise<AccountLink> {
    if (!this.stripe) throw new StripeConnectNotConfiguredError();
    const row = await this.loadEntity(legalEntityId);
    if (!row.stripeConnectAccountId) throw new Error("stripe_account_missing");
    const link = await this.stripe.accounts.createLoginLink(row.stripeConnectAccountId);
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

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await this.applyAccountUpdate(account);
      return { processed: true };
    }
    if (event.type === "capability.updated") {
      // Capability updates also bubble through account.updated; refresh
      // anyway in case Stripe sends only the capability event.
      const cap = event.data.object as Stripe.Capability;
      const accountId = typeof cap.account === "string" ? cap.account : cap.account?.id;
      if (accountId) {
        const account = await this.stripe.accounts.retrieve(accountId);
        await this.applyAccountUpdate(account);
        return { processed: true };
      }
    }
    const eventType = event.type as string;
    if (
      eventType === "transfer.created" ||
      eventType === "transfer.updated" ||
      eventType === "transfer.paid" ||
      eventType === "transfer.failed" ||
      eventType === "transfer.reversed"
    ) {
      const transfer = event.data.object as Stripe.Transfer;
      const isReversal = eventType === "transfer.reversed";
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
    }
    return { processed: false };
  }

  private async applyAccountUpdate(account: Stripe.Account): Promise<void> {
    const requirementsCurrentlyDue = (account.requirements?.currently_due ?? []) as string[];
    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = Boolean(account.payouts_enabled);

    const rows = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.stripeConnectAccountId, account.id))
      .limit(1);
    const row = rows[0];
    if (!row) return;

    const isReady = chargesEnabled && payoutsEnabled && requirementsCurrentlyDue.length === 0;
    const nextStatus = isReady && row.status === "connect_pending" ? "approved" : row.status;

    await this.db.transaction(async (tx) => {
      await tx
        .update(legalEntity)
        .set({
          stripeConnectChargesEnabled: chargesEnabled,
          stripeConnectPayoutsEnabled: payoutsEnabled,
          stripeConnectRequirementsCurrentlyDue: requirementsCurrentlyDue,
          ...(nextStatus !== row.status ? { status: nextStatus, statusChangedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(legalEntity.id, row.id));

      if (
        this.domainEventPublisher &&
        nextStatus === "approved" &&
        row.status === "connect_pending"
      ) {
        await this.domainEventPublisher.publish(tx, {
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
    });
  }

  /** Initiate a Stripe Connect transfer for a settled payout.
   * Retries up to 3 times with exponential backoff on transient errors.
   */
  async initiateTransfer(payoutId: string): Promise<InitiateTransferResult> {
    if (!this.stripe) {
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
      return { ok: false, reason: "connect_not_ready" };
    }

    const amountCents = Math.round(Number.parseFloat(payout.netAmount) * 100);
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
        const transfer = await this.stripe.transfers.create({
          amount: amountCents,
          currency: payout.currency.toLowerCase(),
          destination: entity.stripeConnectAccountId,
          metadata: {
            payoutId: payout.id,
            legalEntityId: payout.legalEntityId,
          },
        });

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
            const delayMs = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }
        } else {
          throw err;
        }
      }
    }

    const errorCode = lastError?.code ?? "unknown";
    const errorMessage = lastError?.message ?? "Transfer failed after retries";

    await this.payoutRepository.updateStatus(payoutId, {
      status: "failed",
      stripeTransferId: null,
      processedAt: new Date(),
      failureReason: `stripe_transfer_failed: ${errorCode} - ${errorMessage}`,
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
