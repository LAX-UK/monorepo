import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { domainEvent, processedStripeEvents } from "@auction/db/schema";
import { UNAPPLIED_MONEY_EVENT, type UnappliedMoney, unappliedMoneyPayload } from "@auction/domain";
import { DrizzleUnappliedMoneyReader } from "@auction/persistence/repositories";
import { and, eq, like, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import { DomainEventSink } from "../domain-event-sink.js";
import { DomainEventPublisher } from "../domain-event.publisher.js";
import { UnappliedMoneyRecorder } from "./unapplied-money.recorder.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * A writer that does not take the recorder's lock (raw insert, a future code path) and the
 * recorder report the same money at once, in two real transactions: the database keeps one
 * event, and the recorder's transaction carries on and commits instead of failing.
 */
describe.skipIf(!HAS_DB)(
  "unapplied money recorder against a concurrent writer (integration)",
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const runner = transactionRunnerFromDb(db);
    const recorder = new UnappliedMoneyRecorder(
      new DrizzleUnappliedMoneyReader(db),
      new DomainEventSink(new DomainEventPublisher(), db),
    );
    const run = randomUUID().slice(0, 8);

    afterAll(async () => {
      await db.delete(domainEvent).where(like(domainEvent.aggregateId, `%${run}%`));
      await db
        .delete(processedStripeEvents)
        .where(like(processedStripeEvents.eventId, `evt_rec_${run}_%`));
    });

    const moneyOf = (n: string): UnappliedMoney => ({
      reason: "invoice_already_paid",
      paymentId: null,
      paymentGroupId: null,
      stripePaymentIntentId: `pi_rec_${run}_${n}`,
      stripeChargeId: `ch_rec_${run}_${n}`,
      stripeCustomerId: null,
      amountCents: 10_000,
      currency: "gbp",
    });
    const rowsFor = async (dedupeKey: string) =>
      db
        .select({ producer: domainEvent.producer })
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.eventType, UNAPPLIED_MONEY_EVENT),
            sql`${domainEvent.payload}->>'dedupeKey' = ${dedupeKey}`,
          ),
        );
    const claimed = async (eventId: string) =>
      (
        await db
          .select({ id: processedStripeEvents.eventId })
          .from(processedStripeEvents)
          .where(eq(processedStripeEvents.eventId, eventId))
      ).length === 1;

    /** Waits until some backend in this database is waiting on a lock (the recorder's insert). */
    const untilBlocked = async () => {
      for (let i = 0; i < 100; i += 1) {
        const rows = await db.execute(
          sql`select count(*)::int as n from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`,
        );
        const n =
          (rows as unknown as { rows?: { n: number }[] }).rows?.[0]?.n ??
          (rows as unknown as { n: number }[])[0]?.n ??
          0;
        if (n > 0) return;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error("the recorder never waited on the other writer");
    };

    async function race(n: string, otherWriterCommits: boolean) {
      const money = moneyOf(n);
      const payload = unappliedMoneyPayload(money);
      const eventId = `evt_rec_${run}_${n}`;
      let release!: () => void;
      const held = new Promise<void>((r) => {
        release = r;
      });
      let inserted!: () => void;
      const ready = new Promise<void>((r) => {
        inserted = r;
      });
      // The other writer: inserts the same key without the advisory lock, and holds its transaction.
      const other = db
        .transaction(async (t) => {
          await t.insert(domainEvent).values({
            aggregateType: "payment",
            aggregateId: `other-${run}-${n}`,
            eventType: UNAPPLIED_MONEY_EVENT,
            payload,
            producer: "other-writer",
          });
          inserted();
          await held;
          if (!otherWriterCommits) throw new Error("other writer rolls back");
        })
        .catch((err: Error) => {
          if (otherWriterCommits) throw err;
        });
      await ready;
      // The recorder, in the webhook's transaction, with its processed-event claim.
      const webhook = runner.runInTransaction(async (tx) => {
        await tx.insert(processedStripeEvents).values({ eventId, source: "payment" });
        await recorder.record(tx, money, null);
      });
      await untilBlocked();
      release();
      await other;
      await webhook;
      return { dedupeKey: payload.dedupeKey, eventId };
    }

    it("the other writer commits first: one event, and the recorder's transaction commits", async () => {
      const { dedupeKey, eventId } = await race("commit", true);
      expect((await rowsFor(dedupeKey)).map((r) => r.producer)).toEqual(["other-writer"]);
      expect(await claimed(eventId)).toBe(true);
    });

    it("the other writer rolls back: the recorder's event is the one kept", async () => {
      const { dedupeKey, eventId } = await race("rollback", false);
      const rows = await rowsFor(dedupeKey);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.producer).not.toBe("other-writer");
      expect(await claimed(eventId)).toBe(true);
    });
  },
);
