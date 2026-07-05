import { statusFromLegalEntityRow } from "@auction/connect";
import type { DbTransaction, ITransactionRunner } from "@auction/persistence/interfaces";
import type { ILegalEntityConnectReader } from "@auction/persistence/interfaces";
import type { ILegalEntityConnectRepository } from "@auction/persistence/interfaces";
import type { LegalEntityConnectRow } from "@auction/persistence/lib";
import type { Redis } from "ioredis";
import type Stripe from "stripe";
import type { Env } from "../../../env.js";
import { checkConnectMutationRateLimit } from "../../../lib/connect-mutation-rate-limit.js";
import { legalEntityRowToDomain } from "../../../lib/legal-entity-row-mapper.js";
import { type AppLogger, createBaseLogger } from "../../../lib/logger.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { recordMoneyPathEvent } from "../../../middleware/metrics.js";
import type { ConnectAccountStatus, CreateAccountResult } from "../../interfaces/stripe-connect.js";
import { loadConnectAccountCreationContext } from "./connect-account-context.loader.js";
import {
  type ConnectAccountController,
  buildIndividualConnectAccountParams,
  buildOrganisationConnectAccountParams,
} from "./connect-account-prefill.js";
import { resolveConnectAccountCountry } from "./connect-country-resolver.js";
import type { ConnectLifecyclePromoter } from "./connect-lifecycle-promoter.js";
import { ConnectServiceError, throwConnectError } from "./connect-service-errors.js";
import { loadConnectLegalEntity, requireConnectStripe } from "./connect-shared.js";

/** Bump when account-create params change or Stripe cached a 4xx under the prior key (24h TTL). */
const CONNECT_ACCOUNT_CREATE_IDEMPOTENCY_VERSION = "v4";

export class ConnectAccountService {
  private readonly logger: AppLogger;

  constructor(
    env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">,
    private readonly transactionRunner: ITransactionRunner,
    private readonly connectReader: ILegalEntityConnectReader,
    private readonly connectRepository: ILegalEntityConnectRepository,
    private readonly stripeFactory: IStripeClientFactory,
    private readonly lifecyclePromoter: ConnectLifecyclePromoter,
    private readonly redis?: Redis,
  ) {
    this.logger = createBaseLogger(env);
  }

  private async assertMutationRateLimit(
    kind: "account" | "sync",
    legalEntityId: string,
  ): Promise<void> {
    if (!this.redis) return;
    const allowed = await checkConnectMutationRateLimit(this.redis, kind, legalEntityId);
    if (!allowed) throwConnectError("stripe_rate_limited", 429);
  }

  statusFromRow(row: LegalEntityConnectRow, syncDegraded = false): ConnectAccountStatus {
    const base = statusFromLegalEntityRow(row);
    return {
      ...base,
      ...(syncDegraded ? { syncDegraded: true } : {}),
    };
  }

  async ensureAccount(legalEntityId: string): Promise<CreateAccountResult> {
    await this.assertMutationRateLimit("account", legalEntityId);
    const stripe = requireConnectStripe(this.stripeFactory);
    const context = await loadConnectAccountCreationContext(this.connectReader, legalEntityId);
    const row = context.entity;

    if (row.stripeConnectAccountId) {
      return {
        stripeAccountId: row.stripeConnectAccountId,
        legalEntity: legalEntityRowToDomain(row),
      };
    }
    if (row.kind === "individual" && context.ownerKycStatus !== "approved") {
      throwConnectError("kyc_not_approved", 403);
    }

    const country = resolveConnectAccountCountry({
      entityAddress: context.entityAddress,
      userAddress: context.userAddress,
      kycIdCountry: context.kyc?.verifiedIdCountry ?? null,
    });

    const controller: ConnectAccountController = {
      fees: { payer: "application" },
      losses: { payments: "application" },
      requirement_collection: "application",
      stripe_dashboard: { type: "none" },
    };

    const accountCreateParams: Stripe.AccountCreateParams =
      row.kind === "organisation"
        ? buildOrganisationConnectAccountParams({
            country,
            legalEntityId,
            row,
            entityAddress: context.entityAddress,
            controller,
          })
        : buildIndividualConnectAccountParams({
            country,
            legalEntityId,
            subkind: row.subkind,
            owner: {
              email: context.ownerEmail,
              firstName: context.ownerFirstName,
              lastName: context.ownerLastName,
              displayName: context.ownerDisplayName,
              mobile: context.ownerMobile,
            },
            kyc: context.kyc,
            entityAddress: context.entityAddress,
            userAddress: context.userAddress,
            controller,
          });

    const account = await stripe.accounts.create(accountCreateParams, {
      idempotencyKey: `connect:account:${CONNECT_ACCOUNT_CREATE_IDEMPOTENCY_VERSION}:${legalEntityId}`,
    });

    const persistUpdate = () =>
      this.connectRepository.persistConnectAccount({
        legalEntityId,
        stripeAccountId: account.id,
        promoteLeadToConnectPending: row.status === "lead",
      });

    let updated = await persistUpdate();
    if (!updated) {
      recordMoneyPathEvent("stripe_connect_account_orphan_created");
      this.logger.error(
        { legalEntityId, stripeAccountId: account.id },
        "connect_account_db_update_failed",
      );
      updated = await persistUpdate();
    }
    if (!updated) {
      throw new ConnectServiceError("legal_entity_update_failed", 500, {
        stripeAccountId: account.id,
      });
    }

    return { stripeAccountId: account.id, legalEntity: legalEntityRowToDomain(updated) };
  }

  async getStatus(legalEntityId: string): Promise<ConnectAccountStatus> {
    const row = await loadConnectLegalEntity(this.connectReader, legalEntityId);
    if (!row.stripeConnectAccountId) {
      return {
        stripeAccountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsCurrentlyDue: [],
        requirementsErrors: [],
        disabledReason: null,
        ready: false,
      };
    }
    return this.statusFromRow(row);
  }

  async syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus> {
    await this.assertMutationRateLimit("sync", legalEntityId);
    const stripe = requireConnectStripe(this.stripeFactory);
    const row = await loadConnectLegalEntity(this.connectReader, legalEntityId);
    if (!row.stripeConnectAccountId) {
      return {
        stripeAccountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsCurrentlyDue: [],
        requirementsErrors: [],
        disabledReason: null,
        ready: false,
      };
    }
    const account = await stripe.accounts.retrieve(row.stripeConnectAccountId);
    await this.applyAccountUpdate(account);
    const refreshed = await loadConnectLegalEntity(this.connectReader, legalEntityId);
    return this.statusFromRow(refreshed);
  }

  async applyAccountUpdate(account: Stripe.Account, tx?: DbTransaction): Promise<void> {
    if (tx) {
      await this.applyAccountUpdateInConnection(account, tx);
      return;
    }
    await this.transactionRunner.runInTransaction(async (conn) => {
      await this.applyAccountUpdateInConnection(account, conn);
    });
  }

  private async applyAccountUpdateInConnection(
    account: Stripe.Account,
    conn: DbTransaction,
  ): Promise<void> {
    const row = await this.connectReader.findLegalEntityRowByStripeAccountId(account.id);
    if (!row) {
      recordMoneyPathEvent("stripe_connect_webhook_orphan_account");
      return;
    }
    await this.lifecyclePromoter.applyStripeAccountFlags(account, row, conn);
  }

  async applyAccountDeauthorized(stripeAccountId: string, tx?: DbTransaction): Promise<void> {
    const run = async (conn: DbTransaction) => {
      const repo = this.connectRepository.forConnection(conn);
      const updated = await repo.applyDeauthorized(stripeAccountId, conn);
      if (!updated) {
        recordMoneyPathEvent("stripe_connect_webhook_orphan_account");
        return;
      }
      recordMoneyPathEvent("stripe_connect_account_deauthorized");
    };
    if (tx) {
      await run(tx);
      return;
    }
    await this.transactionRunner.runInTransaction(run);
  }
}
