import { isStripeAccountConfigured } from "@auction/connect";
import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { DomainEventPublisher } from "../../domain-event.publisher.js";

export class ConnectLifecyclePromoter {
  constructor(private readonly domainEventPublisher?: DomainEventPublisher) {}

  async applyStripeAccountFlags(
    account: Stripe.Account,
    row: typeof legalEntity.$inferSelect,
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
      isLaxManaged: row.isLaxManaged,
    });

    let nextStatus = row.status as typeof row.status;
    if (!row.isLaxManaged) {
      if (configured && row.status === "connect_pending") {
        nextStatus = "approved";
      } else if (!configured && row.status === "approved" && row.stripeConnectAccountId) {
        nextStatus = "connect_pending";
      }
    }

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
