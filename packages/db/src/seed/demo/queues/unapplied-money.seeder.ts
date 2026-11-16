import {
  UNAPPLIED_MONEY_EVENT,
  type UnappliedMoney,
  unappliedMoneyAggregate,
  unappliedMoneyPayload,
} from "@auction/domain";
import { sql } from "drizzle-orm";
import * as schema from "../../../schema/index.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { DEMO_STRIPE } from "./queue-ids.js";
import { writeSeedEvents } from "./seed-events.js";

const DAY = 86_400_000;

/**
 * The money as the customer-balance webhook reports it: a bank transfer that landed in a buyer's
 * Stripe balance with no open invoice to apply it to (one report per event and currency).
 */
export const DEMO_UNAPPLIED_MONEY: UnappliedMoney = {
  reason: "customer_balance_unapplied",
  paymentId: null,
  paymentGroupId: null,
  possibleGroup: null,
  stripePaymentIntentId: null,
  stripeChargeId: null,
  stripeCustomerId: DEMO_STRIPE.customer,
  stripeEventId: `${DEMO_STRIPE.unappliedEvent}:gbp`,
  amountCents: 250_000,
  currency: "gbp",
};

/**
 * Work inbox, Finance: unapplied money. The event is built by the same functions the unapplied
 * money recorder uses (payload, dedupe key, aggregate), with no actor, as the webhook writes it.
 * The demo seed's producer keeps the notification fan-out from emailing finance staff about it.
 * The unique index on the dedupe key keeps it to one event, however often the seed runs.
 */
export const unappliedMoneySeeder: QueueSeeder = {
  queue: "Unapplied money",
  async seed({ db, now }: QueueContext) {
    const payload = unappliedMoneyPayload(DEMO_UNAPPLIED_MONEY);
    const [recorded] = await db
      .select({ one: sql<number>`1` })
      .from(schema.domainEvent)
      .where(
        sql`${schema.domainEvent.eventType} = ${UNAPPLIED_MONEY_EVENT} and ${schema.domainEvent.payload}->>'dedupeKey' = ${payload.dedupeKey}`,
      )
      .limit(1);
    if (recorded) return;
    await writeSeedEvents(db, [
      {
        ...unappliedMoneyAggregate(DEMO_UNAPPLIED_MONEY, payload.dedupeKey),
        eventType: UNAPPLIED_MONEY_EVENT,
        payload,
        actorUserId: null,
        actingLegalEntityId: null,
        occurredAt: new Date(now - 3 * DAY),
      },
    ]);
  },
};
