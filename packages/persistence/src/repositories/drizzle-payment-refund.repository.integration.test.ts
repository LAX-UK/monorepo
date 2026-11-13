import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzlePaymentRefundRepository } from "./drizzle-payment-refund.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("payment refund record (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const buyer = `pr-buyer-${run}`;
  const entity = randomUUID();
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzlePaymentRefundRepository(db);
  const lotIds: string[] = [];

  async function payment(): Promise<string> {
    const lotId = randomUUID();
    const paymentId = randomUUID();
    lotIds.push(lotId);
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
      values (${lotId}, ${entity}, ${`Refund lot ${lotId.slice(0, 6)}`}, 'english', 100, 100,
         now() - interval '40 days', now() - interval '20 days', 'ended', ${buyer}, ${entity})`);
    await db.execute(sql`
      insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
         amount, platform_fee, status)
      values (${paymentId}, ${lotId}, ${buyer}, ${entity}, ${entity}, 600.10, 0, 'captured'::payment_status)`);
    return paymentId;
  }

  const record = (paymentId: string, key: string, amountPence: number, currency = "GBP") =>
    db.transaction((tx) =>
      repo.recordInTransaction(tx, {
        paymentId,
        idempotencyKey: key,
        amountPence,
        currency,
        source: "staff",
      }),
    );

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${buyer}, 'B', ${`${buyer}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entity}, 'Refund entity', 'individual', 'private_collector', ${buyer}, 'approved')`);
  });

  afterAll(async () => {
    await db.execute(sql`
      delete from payout_line where payment_id in
        (select p.id from payment p where p.buyer_legal_entity_id = ${entity})`);
    await db.execute(sql`delete from payout where legal_entity_id = ${entity}`);
    await db.execute(sql`
      delete from payment_refund where payment_id in
        (select p.id from payment p where p.buyer_legal_entity_id = ${entity})`);
    for (const lotId of lotIds) await db.execute(sql`delete from lot where id = ${lotId}`);
    await db.execute(sql`delete from legal_entity where id = ${entity}`);
    await db.execute(sql`delete from "user" where id = ${buyer}`);
  });

  it("is nothing for a payment with no refunds", async () => {
    expect(await repo.sumRefundedPence(await payment())).toEqual({ pence: 0, otherCurrencies: [] });
  });

  it("adds up every refund recorded, reading beyond the payment amount", async () => {
    const paymentId = await payment();
    await record(paymentId, `a-${run}-1`, 10_000);
    await record(paymentId, `a-${run}-2`, 25_000);
    await record(paymentId, `a-${run}-3`, 30_000);
    expect(await repo.sumRefundedPence(paymentId)).toEqual({ pence: 65_000, otherCurrencies: [] });
  });

  it("records a key once and says so on a replay", async () => {
    const paymentId = await payment();
    expect(await record(paymentId, `b-${run}`, 5_000)).toBe(true);
    expect(await record(paymentId, `b-${run}`, 5_000)).toBe(false);
    expect((await repo.sumRefundedPence(paymentId)).pence).toBe(5_000);
  });

  it("reports a currency other than GBP instead of adding it in", async () => {
    const paymentId = await payment();
    await record(paymentId, `c-${run}-1`, 5_000);
    await record(paymentId, `c-${run}-2`, 7_000, "eur");
    expect(await repo.sumRefundedPence(paymentId)).toEqual({
      pence: 5_000,
      otherCurrencies: ["EUR"],
    });
  });

  it("refuses an amount that is not whole pence above zero, and a currency that is not a code", async () => {
    const paymentId = await payment();
    await expect(record(paymentId, `d-${run}-1`, 0)).rejects.toThrow(RangeError);
    await expect(record(paymentId, `d-${run}-2`, 10.5)).rejects.toThrow(RangeError);
    await expect(record(paymentId, `d-${run}-3`, 100, "pounds")).rejects.toThrow();
  });

  it("is written with the transaction it joins: a rollback leaves nothing", async () => {
    const paymentId = await payment();
    await expect(
      db.transaction(async (tx) => {
        await repo.recordInTransaction(tx, {
          paymentId,
          idempotencyKey: `e-${run}`,
          amountPence: 1_000,
          currency: "GBP",
          source: "card_webhook",
        });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect((await repo.sumRefundedPence(paymentId)).pence).toBe(0);
  });

  it("takes a refund back only with a negative refund_reversal row, which the sum includes", async () => {
    const paymentId = await payment();
    await record(paymentId, `r-${run}-1`, 2_500);
    const reverse = (amountPence: number, source: "refund_reversal" | "card_webhook") =>
      db.transaction((tx) =>
        repo.recordInTransaction(tx, {
          paymentId,
          idempotencyKey: `r-${run}-${source}-${amountPence}`,
          amountPence,
          currency: "GBP",
          source,
        }),
      );
    await expect(reverse(2_500, "refund_reversal")).rejects.toThrow(RangeError);
    await expect(reverse(-2_500, "card_webhook")).rejects.toThrow(RangeError);
    expect(await reverse(-2_500, "refund_reversal")).toBe(true);
    expect(await reverse(-2_500, "refund_reversal")).toBe(false);
    expect((await repo.sumRefundedPence(paymentId)).pence).toBe(0);
    // The table holds the same rule, whatever writes to it.
    await expect(
      db.execute(sql`
        insert into payment_refund (payment_id, idempotency_key, amount_pence, currency, source)
        values (${paymentId}, ${`r-${run}-raw`}, -1, 'GBP', 'staff')`),
    ).rejects.toThrow();
  });

  it("the payout-line backfill adds a compensating seller line with its sign, never as a second refund", async () => {
    const paymentId = await payment();
    // A £25 refund clawed back in one payout, then given back in the next one when Stripe
    // reported the refund failed: one line per payout, opposite signs.
    const [first, second, third] = [randomUUID(), randomUUID(), randomUUID()];
    for (const payoutId of [first, second, third]) {
      await db.execute(sql`
        insert into payout (id, legal_entity_id, period_start, period_end, gross_amount,
           platform_fee, stripe_fee, net_amount)
        values (${payoutId}, ${entity}, now() - interval '1 day', now(), 0, 0, 0, 0)`);
    }
    await db.execute(sql`
      insert into payout_line (payout_id, payment_id, amount, kind, source_event_id)
      values (${first}, ${paymentId}, -25.00, 'refund', ${`bf-${run}-1`}),
             (${second}, ${paymentId}, 25.00, 'refund', ${`bf-${run}-2`})`);
    await db.transaction((tx) => repo.lockPaymentInTransaction(tx, paymentId));
    expect((await repo.sumRefundedPence(paymentId)).pence).toBe(0);
    // A refund line alone is still copied in as before.
    await db.execute(sql`
      insert into payout_line (payout_id, payment_id, amount, kind, source_event_id)
      values (${third}, ${paymentId}, -10.00, 'refund', ${`bf-${run}-3`})`);
    await db.transaction((tx) => repo.lockPaymentInTransaction(tx, paymentId));
    expect((await repo.sumRefundedPence(paymentId)).pence).toBe(1_000);
  });
});
