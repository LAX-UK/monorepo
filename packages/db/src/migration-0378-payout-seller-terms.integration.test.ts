import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import { buildPgConnectionConfig } from "./ssl.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;

type Row = Record<string, unknown>;

/** Every probe runs in a savepoint inside one transaction that is rolled back at the end. */
describe.skipIf(!url)("migration 0378 payout seller terms (database)", { timeout: 60_000 }, () => {
  let client: pg.Client;
  let sellerId: string;
  let paymentId: string;
  let payoutId: string;
  let termsId: string;

  async function accepts(table: string, row: Row): Promise<boolean> {
    const columns = Object.keys(row);
    await client.query("savepoint probe");
    try {
      await client.query(
        `insert into ${table} (${columns.map((c) => `"${c}"`).join(", ")}) values (${columns
          .map((_, i) => `$${i + 1}`)
          .join(", ")})`,
        Object.values(row),
      );
      return true;
    } catch {
      return false;
    } finally {
      await client.query("rollback to savepoint probe");
    }
  }

  const line = (patch: Row) =>
    accepts("payout_line", {
      payout_id: payoutId,
      payment_id: paymentId,
      amount: "82000.00",
      kind: "sale",
      ...patch,
    });

  const payoutRow = (patch: Row) =>
    accepts("payout", {
      legal_entity_id: sellerId,
      period_start: new Date("2026-11-01T00:00:00Z"),
      period_end: new Date("2026-11-02T00:00:00Z"),
      gross_amount: "82000.00",
      platform_fee: "14760.00",
      stripe_fee: "0.00",
      net_amount: "67240.00",
      ...patch,
    });

  beforeAll(async () => {
    if (!url) return;
    client = new Client(buildPgConnectionConfig(url));
    await client.connect();
    await client.query("begin");
    const one = async (text: string, values: unknown[] = []) =>
      (await client.query<{ id: string }>(text, values)).rows[0]?.id as string;
    const userId = `u-${Date.now()}`;
    await client.query(
      `insert into "user" (id, name, email, created_at, updated_at)
       values ($1, 'Seller', $2, now(), now())`,
      [userId, `${userId}@example.test`],
    );
    sellerId = await one(
      `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
       values ('organisation', 'gallery', $1, $2) returning id`,
      [`Seller gallery ${Date.now()}`, userId],
    );
    const buyerId = await one(
      `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
       values ('individual', 'private_collector', $1, $2) returning id`,
      [`Buyer ${Date.now()}`, userId],
    );
    const saleId = await one(
      `insert into sale (title, start_time, end_time, created_by_legal_entity_id)
       values ('Sale', now(), now() + interval '1 day', $1) returning id`,
      [sellerId],
    );
    const lotId = await one(
      `insert into lot (sale_id, title, auction_type, starting_price, current_price, start_time, end_time, seller_legal_entity_id)
       values ($1, 'Lot', 'english', 0, 0, now(), now() + interval '1 day', $2) returning id`,
      [saleId, sellerId],
    );
    paymentId = await one(
      `insert into payment (lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id, amount, platform_fee)
       values ($1, $2, $3, $4, 102500, 5125) returning id`,
      [lotId, userId, buyerId, sellerId],
    );
    termsId = await one(
      `insert into sale_seller_terms (payment_id, lot_id, seller_legal_entity_id, basis, held_reason, hammer_pence, premium_pence, rule_version)
       values ($1, $2, $3, 'held', 'no_agreement', 8200000, 2050000, 'agreement_hammer_v1') returning id`,
      [paymentId, lotId, sellerId],
    );
    payoutId = await one(
      `insert into payout (legal_entity_id, period_start, period_end, gross_amount, platform_fee, stripe_fee, net_amount)
       values ($1, now() - interval '1 day', now(), 0, 0, 0, 0) returning id`,
      [sellerId],
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.query("rollback");
    await client.end();
  });

  it("lets only a lot's sale line point at the snapshot it pays", async () => {
    expect(await line({ seller_terms_id: termsId })).toBe(true);
    expect(await line({})).toBe(true);
    expect(await line({ seller_terms_id: termsId, kind: "refund", amount: "-100.00" })).toBe(false);
    expect(
      await line({ seller_terms_id: termsId, payment_id: null, kind: "adjustment", note: "x" }),
    ).toBe(false);
    expect(await line({ seller_terms_id: "00000000-0000-0000-0000-000000000000" })).toBe(false);
  });

  it("keeps the buyer's refund only on refund lines, negative only on a line giving money back", async () => {
    expect(
      await line({ kind: "refund", amount: "-67240.00", buyer_refund_pence: 10_250_000 }),
    ).toBe(true);
    // A failed refund given back: the share it charged, or nothing, comes back.
    expect(
      await line({ kind: "refund", amount: "67240.00", buyer_refund_pence: -10_250_000 }),
    ).toBe(true);
    expect(await line({ kind: "refund", amount: "0.00", buyer_refund_pence: -1 })).toBe(true);
    // A negative buyer refund never takes money from the seller.
    expect(await line({ kind: "refund", amount: "-1.00", buyer_refund_pence: -1 })).toBe(false);
    expect(await line({ buyer_refund_pence: 100 })).toBe(false);
    expect(await line({ amount: "1.00", buyer_refund_pence: -100 })).toBe(false);
  });

  it("writes the three seller-terms totals together and never below zero", async () => {
    expect(await payoutRow({})).toBe(true);
    expect(
      await payoutRow({
        hammer_amount: "82000.00",
        commission_amount: "12300.00",
        commission_vat_amount: "2460.00",
      }),
    ).toBe(true);
    expect(await payoutRow({ hammer_amount: "82000.00" })).toBe(false);
    expect(
      await payoutRow({
        hammer_amount: "82000.00",
        commission_amount: "-1.00",
        commission_vat_amount: "0.00",
      }),
    ).toBe(false);
  });
});

const rollbackSql = () =>
  readFile(resolve(import.meta.dirname, "../drizzle/0378_rollback.sql"), "utf8");

/** A seller's captured payment; returns the seller and payment ids. */
async function seedPayment(pool: pg.Pool): Promise<{ sellerId: string; paymentId: string }> {
  const one = async (text: string, values: unknown[] = []) =>
    (await pool.query<{ id: string }>(text, values)).rows[0]?.id as string;
  const userId = `rollback-${Date.now()}`;
  await pool.query(
    `insert into "user" (id, name, email, created_at, updated_at)
     values ($1, 'Seller', $2, now(), now())`,
    [userId, `${userId}@example.test`],
  );
  const sellerId = await one(
    `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
     values ('organisation', 'gallery', 'Seller gallery', $1) returning id`,
    [userId],
  );
  const buyerId = await one(
    `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
     values ('individual', 'private_collector', 'Buyer', $1) returning id`,
    [userId],
  );
  const saleId = await one(
    `insert into sale (title, start_time, end_time, created_by_legal_entity_id)
     values ('Sale', now(), now() + interval '1 day', $1) returning id`,
    [sellerId],
  );
  const lotId = await one(
    `insert into lot (sale_id, title, auction_type, starting_price, current_price, start_time, end_time, seller_legal_entity_id)
     values ($1, 'Lot', 'english', 0, 0, now(), now() + interval '1 day', $2) returning id`,
    [saleId, sellerId],
  );
  const paymentId = await one(
    `insert into payment (lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id, amount, platform_fee)
     values ($1, $2, $3, $4, 1000, 180) returning id`,
    [lotId, userId, buyerId, sellerId],
  );
  return { sellerId, paymentId };
}

async function hasBuyerRefundColumn(pool: pg.Pool): Promise<boolean> {
  const { rows } = await pool.query(
    `select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'payout_line' and column_name = 'buyer_refund_pence'`,
  );
  return rows.length > 0;
}

/** Runs the rollback file on its own connection, as an operator would, and cleans up after a failure. */
async function runRollback(pool: pg.Pool): Promise<void> {
  const sql = await rollbackSql();
  const client = await pool.connect();
  try {
    await client.query(sql);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

describe.skipIf(!url)("migration 0378 rollback", { timeout: 120_000 }, () => {
  it("refuses while a refund line charged other than the buyer's refund, and runs once none does", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const { sellerId, paymentId } = await seedPayment(pool);
      // A payment has one refund line per payout, so each line is on a payout of its own.
      const refundLine = (amount: string, buyerRefundPence: number | null, note: string) =>
        pool.query(
          `with p as (
             insert into payout (legal_entity_id, period_start, period_end, gross_amount, platform_fee, stripe_fee, net_amount)
             values ($1, now() - interval '1 day', now(), 0, 0, 0, 0) returning id
           )
           insert into payout_line (payout_id, payment_id, amount, kind, note, buyer_refund_pence)
           select p.id, $2, $3, 'refund', $4, $5 from p`,
          [sellerId, paymentId, amount, note, buyerRefundPence],
        );
      // Lines the previous release reads correctly: one of its own, and one charged in full.
      await refundLine("-100.00", null, "before this release");
      await refundLine("-50.00", 5_000, "charged in full");
      // The seller's share of a £500 refund, and a credit back to the share.
      await refundLine("-328.00", 50_000, "share");
      await refundLine("172.00", 0, "true-up");

      await expect(runRollback(pool)).rejects.toThrow(
        /2 refund line\(s\) charge the seller other than the buyer's refund; 0378 is forward-fix only/,
      );
      // Nothing was rolled back.
      expect(await hasBuyerRefundColumn(pool)).toBe(true);
      await pool.query("select payment_refund_backfill_from_payout_lines($1::uuid)", [paymentId]);
      const recorded = await pool.query<{ pence: string }>(
        "select coalesce(sum(amount_pence), 0)::text as pence from payment_refund where payment_id = $1",
        [paymentId],
      );
      expect(Number(recorded.rows[0]?.pence)).toBe(10_000 + 5_000 + 50_000);

      await pool.query(`delete from payout_line where note in ('share', 'true-up')`);
      await runRollback(pool);
      expect(await hasBuyerRefundColumn(pool)).toBe(false);
      // Run again, it finds nothing left to remove.
      await runRollback(pool);
    });
  });

  it("refuses while a failed refund was given back by the new rule, even one charged in full", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const { sellerId, paymentId } = await seedPayment(pool);
      const refundLine = (amount: string, buyerRefundPence: number | null, note: string) =>
        pool.query(
          `with p as (
             insert into payout (legal_entity_id, period_start, period_end, gross_amount, platform_fee, stripe_fee, net_amount)
             values ($1, now() - interval '1 day', now(), 0, 0, 0, 0) returning id
           )
           insert into payout_line (payout_id, payment_id, amount, kind, note, buyer_refund_pence)
           select p.id, $2, $3, 'refund', $4, $5 from p`,
          [sellerId, paymentId, amount, note, buyerRefundPence],
        );
      // A £50 refund charged in full, which then failed and was given back in full: the amounts
      // alone add up for the previous release, but the negative buyer refund is the new rule's.
      await refundLine("-50.00", 5_000, "charged in full");
      await refundLine("50.00", -5_000, "given back");

      await expect(runRollback(pool)).rejects.toThrow(
        /1 refund line\(s\) charge the seller other than the buyer's refund; 0378 is forward-fix only/,
      );
      expect(await hasBuyerRefundColumn(pool)).toBe(true);
      // The top-up adds the lines up with their sign: the give-back cancels the charge.
      await pool.query("select payment_refund_backfill_from_payout_lines($1::uuid)", [paymentId]);
      const recorded = await pool.query<{ n: string }>(
        "select count(*)::text as n from payment_refund where payment_id = $1",
        [paymentId],
      );
      expect(Number(recorded.rows[0]?.n)).toBe(0);

      await pool.query(`delete from payout_line where note = 'given back'`);
      await runRollback(pool);
      expect(await hasBuyerRefundColumn(pool)).toBe(false);
    });
  });

  it("runs on a database with no payouts", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      await runRollback(pool);
      expect(await hasBuyerRefundColumn(pool)).toBe(false);
    });
  });
});
