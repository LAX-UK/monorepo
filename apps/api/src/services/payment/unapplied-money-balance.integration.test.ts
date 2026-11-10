import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { DrizzleUnappliedMoneyReader } from "@auction/persistence/repositories";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import { DomainEventSink } from "../domain-event-sink.js";
import { DomainEventPublisher } from "../domain-event.publisher.js";
import { UnappliedMoneyRecorder } from "./unapplied-money.recorder.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** Balance reports for a customer, through the real recorder, reader and event sink. */
describe.skipIf(!HAS_DB)("customer balance reports (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const runner = transactionRunnerFromDb(db);
  const reader = new DrizzleUnappliedMoneyReader(db);
  const recorder = new UnappliedMoneyRecorder(
    reader,
    new DomainEventSink(new DomainEventPublisher(), db),
  );
  const run = randomUUID().slice(0, 8);

  afterAll(async () => {
    await db.delete(domainEvent).where(sql`${domainEvent.payload}::text like ${`%${run}%`}`);
  });

  const report = (customer: string, event: string, currency: string) =>
    runner.runInTransaction((tx) =>
      recorder.record(
        tx,
        {
          reason: "customer_balance_unapplied",
          paymentId: null,
          paymentGroupId: null,
          stripePaymentIntentId: null,
          stripeChargeId: null,
          stripeCustomerId: customer,
          stripeEventId: `evt_${run}_${event}:${currency}`,
          amountCents: 10_000,
          currency,
        },
        null,
      ),
    );

  const open = (customer: string, currency?: string) =>
    reader.listOpen({
      reasons: ["customer_balance_unapplied"],
      stripeCustomerId: customer,
      ...(currency ? { currency } : {}),
      limit: 10,
    });

  it("two reports for one customer at once leave exactly one open task", async () => {
    const customer = `cus_${run}_race`;
    await Promise.all([report(customer, "x", "gbp"), report(customer, "y", "gbp")]);
    expect(await open(customer)).toHaveLength(1);
  });

  it("a report in one currency leaves the customer's other currencies open", async () => {
    const customer = `cus_${run}_cur`;
    await report(customer, "a", "gbp");
    await report(customer, "b", "eur");
    await report(customer, "c", "gbp");
    expect((await open(customer, "GBP")).map((m) => m.dedupeKey)).toEqual([
      `customer_balance_unapplied:evt_${run}_c:gbp`,
    ]);
    expect(await open(customer, "EUR")).toHaveLength(1);
  });
});
