import {
  buildStripeConnectFlagPatch,
  isStripeAccountConfigured,
  statusFromLegalEntityRow,
} from "@auction/connect";
import type { DbTransaction, ITransactionRunner } from "@auction/persistence/interfaces";
import type { ILegalEntityConnectRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityConnectReader } from "@auction/persistence/interfaces";
import type { LegalEntityConnectRow } from "@auction/persistence/lib";
import type Stripe from "stripe";
import type { IDomainEventSinkPort } from "../domain-event-sink-port.js";
import type { ConnectAccountStatus } from "../payout/types.js";
import { connectReadyFromCachedEntity } from "./connect-shared.js";
import type { IStripeClientFactory } from "./stripe-client-factory.js";

export class ConnectLifecyclePromoter {
  constructor(
    private readonly connectRepository: ILegalEntityConnectRepository,
    private readonly domainEventSink?: IDomainEventSinkPort | null,
  ) {}

  async applyStripeAccountFlags(
    account: Stripe.Account,
    row: LegalEntityConnectRow,
    tx: DbTransaction,
  ): Promise<void> {
    const flags = buildStripeConnectFlagPatch(account);

    const configured = isStripeAccountConfigured({
      status: row.status,
      stripeConnectAccountId: row.stripeConnectAccountId,
      stripeConnectPayoutsEnabled: flags.stripeConnectPayoutsEnabled,
      stripeConnectRequirementsCurrentlyDue: flags.stripeConnectRequirementsCurrentlyDue,
      stripeConnectDisabledReason: flags.stripeConnectDisabledReason,
      isLaxManaged: row.isLaxManaged,
    });

    let nextStatus = row.status;
    if (!row.isLaxManaged) {
      if (configured && row.status === "connect_pending") {
        nextStatus = "approved";
      } else if (!configured && row.status === "approved" && row.stripeConnectAccountId) {
        nextStatus = "connect_pending";
      }
    }

    const repo = this.connectRepository.forConnection(tx);
    if (nextStatus === row.status) {
      await repo.updateStripeConnectFlags(row.id, flags, tx);
      return;
    }

    const updated = await repo.applyConnectStatusTransition(
      {
        legalEntityId: row.id,
        expectedStatus: row.status,
        nextStatus,
        flags,
      },
      tx,
    );

    if (!updated || !this.domainEventSink) return;

    if (nextStatus === "approved" && row.status === "connect_pending") {
      await this.domainEventSink.withTx(tx).publish({
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

    if (nextStatus === "connect_pending" && row.status === "approved") {
      await this.domainEventSink.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: row.id as string,
        eventType: "legal_entity.lifecycle_progressed",
        payload: {
          kind: row.kind,
          from_status: "approved",
          to_status: "connect_pending",
          reason: "stripe_connect_requirements_due",
          stripeAccountId: account.id,
        },
        actorUserId: null,
        actingLegalEntityId: row.id as string,
      });
    }
  }
}

export class ConnectReadinessSyncService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly connectReader: ILegalEntityConnectReader,
    private readonly stripeFactory: IStripeClientFactory,
    private readonly lifecyclePromoter: ConnectLifecyclePromoter,
  ) {}

  async syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus> {
    const stripe = this.stripeFactory.get();
    const row = await this.connectReader.findLegalEntityRowById(legalEntityId);
    if (!row) {
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
    if (!stripe || !row.stripeConnectAccountId) {
      const base = statusFromLegalEntityRow(row);
      return { ...base, ready: connectReadyFromCachedEntity(row) };
    }

    const account = await stripe.accounts.retrieve(row.stripeConnectAccountId);
    await this.transactionRunner.runInTransaction(async (tx) => {
      await this.lifecyclePromoter.applyStripeAccountFlags(account, row, tx);
    });
    const refreshed = await this.connectReader.findLegalEntityRowById(legalEntityId);
    if (!refreshed) {
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
    const base = statusFromLegalEntityRow(refreshed);
    return { ...base, ready: base.ready };
  }
}
