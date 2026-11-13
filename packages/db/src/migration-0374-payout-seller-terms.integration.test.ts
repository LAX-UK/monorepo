import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;

type Row = Record<string, unknown>;

/** Every probe runs in a savepoint inside one transaction that is rolled back at the end. */
describe.skipIf(!url)("migration 0374 payout seller terms (database)", { timeout: 60_000 }, () => {
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

  it("keeps the buyer's refund only on refund lines, never negative", async () => {
    expect(
      await line({ kind: "refund", amount: "-67240.00", buyer_refund_pence: 10_250_000 }),
    ).toBe(true);
    expect(await line({ kind: "refund", amount: "-1.00", buyer_refund_pence: -1 })).toBe(false);
    expect(await line({ buyer_refund_pence: 100 })).toBe(false);
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
