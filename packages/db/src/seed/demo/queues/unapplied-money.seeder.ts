import { UNAPPLIED_MONEY_EVENT, type UnappliedMoneyPayload } from "@auction/domain";
import * as schema from "../../../schema/index.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";

const DAY = 86_400_000;

/** The payload of the one piece of money the demo could not match to an invoice. */
export const DEMO_UNAPPLIED_MONEY: UnappliedMoneyPayload = {
  reason: "customer_balance_unapplied",
  paymentId: null,
  paymentGroupId: null,
  stripePaymentIntentId: null,
  stripeChargeId: null,
  stripeCustomerId: "cus_demo_example",
  cashBalanceTransactionId: "cbtxn_demo_example_0001",
  amountCents: 250_000,
  currency: "GBP",
  dedupeKey: "demo:unapplied-money:0001",
};

/** Finance inbox: a bank transfer arrived with no open invoice to apply it to. */
export const unappliedMoneySeeder: QueueSeeder = {
  queue: "Unapplied money",
  async seed({ db, now, people }: QueueContext) {
    // The unique index on the dedupe key makes a second run add nothing.
    await db
      .insert(schema.domainEvent)
      .values({
        aggregateType: "payment",
        aggregateId: DEMO_UNAPPLIED_MONEY.dedupeKey,
        eventType: UNAPPLIED_MONEY_EVENT,
        payload: DEMO_UNAPPLIED_MONEY,
        producer: "demo-seed",
        actorUserId: people.laxFinance,
        occurredAt: new Date(now - 3 * DAY),
      })
      .onConflictDoNothing();
  },
};
