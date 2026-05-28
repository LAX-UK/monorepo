import { statusFromLegalEntityRow } from "@auction/connect";
import type { Database } from "@auction/db";
import { legalEntity, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { Env } from "../../../env.js";
import { legalEntityRowToDomain } from "../../../lib/legal-entity-row-mapper.js";
import { type AppLogger, createBaseLogger } from "../../../lib/logger.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { recordMoneyPathEvent } from "../../../middleware/metrics.js";
import type { ConnectAccountStatus, CreateAccountResult } from "../../interfaces/stripe-connect.js";
import { StripeConnectNotConfiguredError } from "../../interfaces/stripe-connect.js";
import type { ConnectLifecyclePromoter } from "./connect-lifecycle-promoter.js";

export class ConnectAccountService {
  private readonly logger: AppLogger;

  constructor(
    env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">,
    private readonly db: Database,
    private readonly stripeFactory: IStripeClientFactory,
    private readonly lifecyclePromoter: ConnectLifecyclePromoter,
  ) {
    this.logger = createBaseLogger(env);
  }

  private get stripe(): Stripe | null {
    return this.stripeFactory.get();
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

  private async loadLegalEntityWithOwner(legalEntityId: string) {
    const rows = await this.db
      .select({
        entity: legalEntity,
        ownerEmail: user.email,
        ownerFirstName: user.firstName,
        ownerLastName: user.lastName,
        ownerDisplayName: user.name,
        ownerKycStatus: user.kycStatus,
      })
      .from(legalEntity)
      .innerJoin(user, eq(user.id, legalEntity.createdByUserId))
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error("legal_entity_not_found");
    return row;
  }

  statusFromRow(row: typeof legalEntity.$inferSelect, syncDegraded = false): ConnectAccountStatus {
    const base = statusFromLegalEntityRow(row);
    return {
      ...base,
      chargesEnabled: row.stripeConnectChargesEnabled,
      ...(syncDegraded ? { syncDegraded: true } : {}),
    };
  }

  async ensureAccount(legalEntityId: string, country: string): Promise<CreateAccountResult> {
    const stripe = this.requireStripe();
    const {
      entity: row,
      ownerEmail,
      ownerFirstName,
      ownerLastName,
      ownerDisplayName,
      ownerKycStatus,
    } = await this.loadLegalEntityWithOwner(legalEntityId);
    if (row.stripeConnectAccountId) {
      return {
        stripeAccountId: row.stripeConnectAccountId,
        legalEntity: legalEntityRowToDomain(row),
      };
    }
    if (row.kind === "individual" && ownerKycStatus !== "approved") {
      throw new Error("kyc_not_approved");
    }

    const controller = {
      fees: { payer: "application" as const },
      losses: { payments: "application" as const },
    };

    const accountCreateParams: Stripe.AccountCreateParams =
      row.kind === "organisation"
        ? {
            type: "express",
            country,
            controller,
            capabilities: { transfers: { requested: true } },
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
              controller,
              capabilities: { transfers: { requested: true } },
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
        ...(row.kind === "individual" && row.status === "lead"
          ? { status: "connect_pending" as const, statusChangedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(legalEntity.id, legalEntityId))
      .returning();
    if (!updated) throw new Error("legal_entity_update_failed");

    return { stripeAccountId: account.id, legalEntity: legalEntityRowToDomain(updated) };
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
    if (this.stripe) {
      try {
        return await this.syncAccountFromStripe(legalEntityId);
      } catch (err) {
        this.logger.warn(
          { legalEntityId, err: err instanceof Error ? err.message : String(err) },
          "stripe_connect_sync_degraded",
        );
        recordMoneyPathEvent("stripe_connect_sync_degraded");
      }
    }
    return this.statusFromRow(row, true);
  }

  async syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus> {
    const stripe = this.requireStripe();
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
    const account = await stripe.accounts.retrieve(row.stripeConnectAccountId);
    await this.applyAccountUpdate(account);
    const refreshed = await this.loadEntity(legalEntityId);
    return this.statusFromRow(refreshed);
  }

  async applyAccountUpdate(account: Stripe.Account, db: Database = this.db): Promise<void> {
    const rows = await db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.stripeConnectAccountId, account.id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      recordMoneyPathEvent("stripe_connect_webhook_orphan_account");
      return;
    }
    await this.lifecyclePromoter.applyStripeAccountFlags(account, row, db);
  }
}
