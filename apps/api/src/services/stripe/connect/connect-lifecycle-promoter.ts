import { isStripeAccountConfigured } from "@auction/connect";
import type { Database } from "@auction/db";
import type Stripe from "stripe";
import type { ILegalEntityConnectRepository } from "../../../repositories/interfaces/legal-entity-connect.repository.js";
import type { LegalEntityConnectRow } from "../../../repositories/legal-entity-connect.types.js";
import type { DomainEventPublisher } from "../../domain-event.publisher.js";

export class ConnectLifecyclePromoter {
  constructor(
    private readonly connectRepository: ILegalEntityConnectRepository,
    private readonly domainEventPublisher?: DomainEventPublisher,
  ) {}

  async applyStripeAccountFlags(
    account: Stripe.Account,
    row: LegalEntityConnectRow,
    db: Database,
  ): Promise<void> {
    const requirementsCurrentlyDue = (account.requirements?.currently_due ?? []) as string[];
    const disabledReason =
      typeof account.requirements?.disabled_reason === "string"
        ? account.requirements.disabled_reason
        : null;
    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = Boolean(account.payouts_enabled);

    const configured = isStripeAccountConfigured({
      status: row.status,
      stripeConnectAccountId: row.stripeConnectAccountId,
      stripeConnectPayoutsEnabled: payoutsEnabled,
      stripeConnectRequirementsCurrentlyDue: requirementsCurrentlyDue,
      stripeConnectDisabledReason: disabledReason,
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

    const flags = {
      stripeConnectChargesEnabled: chargesEnabled,
      stripeConnectPayoutsEnabled: payoutsEnabled,
      stripeConnectRequirementsCurrentlyDue: requirementsCurrentlyDue,
      stripeConnectDisabledReason: disabledReason,
    };

    const repo = this.connectRepository.forConnection(db);
    if (nextStatus === row.status) {
      await repo.updateStripeConnectFlags(row.id, flags, db);
      return;
    }

    const updated = await repo.applyConnectStatusTransition(
      {
        legalEntityId: row.id,
        expectedStatus: row.status,
        nextStatus,
        flags,
      },
      db,
    );

    if (!updated) return;

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

    if (
      this.domainEventPublisher &&
      nextStatus === "connect_pending" &&
      row.status === "approved"
    ) {
      await this.domainEventPublisher.publish(db, {
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
