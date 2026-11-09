import { randomUUID } from "node:crypto";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import {
  migrationTestDatabaseUrl as migrationUrl,
  withTemporaryDatabase,
} from "./testing/temporary-database.js";

/** The journal time of the last migration before 0344. */
const BEFORE_0344_FOLDER_MILLIS = 1804233600000;

const UNIQUE = "23505";
const CHECK = "23514";
const FOREIGN_KEY = "23503";
const TOO_LONG = "22001";

async function code(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

type Fixture = {
  payment: () => Promise<string>;
  payoutLine: (over: {
    paymentId: string | null;
    amount: string;
    kind?: string;
    sourceEventId?: string | null;
  }) => Promise<string>;
};

async function fixture(pool: pg.Pool): Promise<Fixture> {
  const userId = `pr-user-${randomUUID()}`;
  const entityId = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, $1, $2, true, now(), now())`,
    [userId, `${userId}@integration.test`],
  );
  await pool.query(
    `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
     values ($1, 'Seller', 'individual', 'private_collector', $2, 'approved')`,
    [entityId, userId],
  );
  const payoutId = async () => {
    const id = randomUUID();
    await pool.query(
      `insert into payout (id, legal_entity_id, period_start, period_end, gross_amount,
         platform_fee, stripe_fee, net_amount)
       values ($1, $2, now() - interval '7 days', now(), 0, 0, 0, 0)`,
      [id, entityId],
    );
    return id;
  };
  return {
    async payment() {
      const lotId = randomUUID();
      const paymentId = randomUUID();
      await pool.query(
        `insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
           current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
         values ($1, $2, 'Refund lot', 'english', 100, 100, now() - interval '30 days',
           now() - interval '20 days', 'ended', $3, $2)`,
        [lotId, entityId, userId],
      );
      await pool.query(
        `insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
           amount, platform_fee, status)
         values ($1, $2, $3, $4, $4, 600.10, 0, 'captured'::payment_status)`,
        [paymentId, lotId, userId, entityId],
      );
      return paymentId;
    },
    async payoutLine(over) {
      const id = randomUUID();
      await pool.query(
        `insert into payout_line (id, payout_id, payment_id, amount, kind, source_event_id)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          await payoutId(),
          over.paymentId,
          over.amount,
          over.kind ?? "refund",
          over.sourceEventId ?? null,
        ],
      );
      return id;
    },
  };
}

describe.skipIf(!migrationUrl)("migration 0344 payment refund", { timeout: 120_000 }, () => {
  const rowsOf = async (pool: pg.Pool, paymentId: string) =>
    (
      await pool.query<{ idempotency_key: string; amount_pence: number; source: string }>(
        `select idempotency_key, amount_pence, source from payment_refund
          where payment_id = $1 order by idempotency_key`,
        [paymentId],
      )
    ).rows;
  const backfill = async (pool: pg.Pool, paymentId?: string) =>
    (
      await pool.query<{ added: number }>(
        "select payment_refund_backfill_from_payout_lines($1::uuid) as added",
        [paymentId ?? null],
      )
    ).rows[0]?.added;

  it("tops up each payment with the sum of its refund lines when it runs, whatever the lines' source", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_0344_FOLDER_MILLIS);
      const f = await fixture(pool);
      const card = await f.payment();
      const staff = await f.payment();
      const untouched = await f.payment();
      await f.payoutLine({ paymentId: card, amount: "-250.50", sourceEventId: "evt_1Nabc" });
      await f.payoutLine({
        paymentId: card,
        amount: "-100.00",
        sourceEventId: `evt_1Ndef:${card}`,
      });
      await f.payoutLine({
        paymentId: staff,
        amount: "-600.10",
        sourceEventId: `admin_refund:${staff}`,
      });
      await f.payoutLine({ paymentId: staff, amount: "-0.01" });
      // Not refunds of a payment: another kind, a refund naming no payment, a zero line.
      await f.payoutLine({ paymentId: untouched, amount: "600.10", kind: "sale" });
      await f.payoutLine({ paymentId: null, amount: "-10.00" });
      await f.payoutLine({ paymentId: untouched, amount: "0.00" });

      await runMigrationsPerTransaction(pool);

      expect(await rowsOf(pool, card)).toEqual([
        {
          idempotency_key: `payout_ledger_topup:${card}:35050`,
          amount_pence: 35_050,
          source: "payout_topup",
        },
      ]);
      expect(await rowsOf(pool, staff)).toEqual([
        {
          idempotency_key: `payout_ledger_topup:${staff}:60011`,
          amount_pence: 60_011,
          source: "payout_topup",
        },
      ]);
      expect(await rowsOf(pool, untouched)).toEqual([]);
    });
  });

  it("does not count a line merged during the rollout gap twice", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_0344_FOLDER_MILLIS);
      const f = await fixture(pool);
      const paymentId = await f.payment();
      const lineId = await f.payoutLine({ paymentId, amount: "-100.00", sourceEventId: "evt_e0" });
      await runMigrationsPerTransaction(pool);
      expect(await rowsOf(pool, paymentId)).toEqual([
        {
          idempotency_key: `payout_ledger_topup:${paymentId}:10000`,
          amount_pence: 10_000,
          source: "payout_topup",
        },
      ]);

      // The previous release merges the next refunds into the same line and takes the newest event id.
      await pool.query(
        "update payout_line set amount = -300.00, source_event_id = 'evt_gap' where id = $1",
        [lineId],
      );
      expect(await backfill(pool)).toBe(1);
      const rows = await rowsOf(pool, paymentId);
      expect(rows.reduce((total, r) => total + r.amount_pence, 0)).toBe(30_000);
    });
  });

  it("tops up a seller-only line merged after the buyer side was recorded, once", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_0344_FOLDER_MILLIS);
      const f = await fixture(pool);
      const paymentId = await f.payment();
      await runMigrationsPerTransaction(pool);
      // The new code recorded 200.00 on the buyer side; the seller line (merged under a newer id) says 250.00.
      await pool.query(
        `insert into payment_refund (payment_id, idempotency_key, amount_pence, currency, source)
         values ($1, 'evt_buyer', 20000, 'GBP', 'card_webhook')`,
        [paymentId],
      );
      await f.payoutLine({ paymentId, amount: "-250.00", sourceEventId: "evt_seller_only" });
      expect(await backfill(pool, paymentId)).toBe(1);
      expect(await backfill(pool, paymentId)).toBe(0);
      expect(await rowsOf(pool, paymentId)).toEqual([
        { idempotency_key: "evt_buyer", amount_pence: 20_000, source: "card_webhook" },
        {
          idempotency_key: `payout_ledger_topup:${paymentId}:25000`,
          amount_pence: 5_000,
          source: "payout_topup",
        },
      ]);
    });
  });

  it("adds nothing where the buyer side is already higher, and nothing again on a re-run", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_0344_FOLDER_MILLIS);
      const f = await fixture(pool);
      const paymentId = await f.payment();
      await runMigrationsPerTransaction(pool);
      await pool.query(
        `insert into payment_refund (payment_id, idempotency_key, amount_pence, currency, source)
         values ($1, 'evt_group_excess', 50000, 'GBP', 'group_webhook')`,
        [paymentId],
      );
      await f.payoutLine({ paymentId, amount: "-100.00", sourceEventId: "evt_seller" });
      expect(await backfill(pool)).toBe(0);
      expect(await rowsOf(pool, paymentId)).toHaveLength(1);

      await f.payoutLine({
        paymentId: await f.payment(),
        amount: "-5.00",
        sourceEventId: "evt_other",
      });
      expect(await backfill(pool)).toBe(1);
      expect(await backfill(pool)).toBe(0);
    });
  });

  it("is harmless when run by several sessions at once", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_0344_FOLDER_MILLIS);
      const f = await fixture(pool);
      await runMigrationsPerTransaction(pool);
      const paymentId = await f.payment();
      await f.payoutLine({ paymentId, amount: "-80.00", sourceEventId: "evt_race" });
      await Promise.all(
        Array.from({ length: 6 }, (_, i) => backfill(pool, i % 2 === 0 ? paymentId : undefined)),
      );
      expect(await rowsOf(pool, paymentId)).toEqual([
        {
          idempotency_key: `payout_ledger_topup:${paymentId}:8000`,
          amount_pence: 8_000,
          source: "payout_topup",
        },
      ]);
    });
  });

  it("keeps a refund to a payment, once per key, positive, in a currency code and a known source", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const paymentId = await f.payment();
      const insert = (over: Record<string, unknown>) => {
        const row = {
          payment_id: paymentId,
          idempotency_key: randomUUID(),
          amount_pence: 1_000,
          currency: "GBP",
          source: "staff",
          ...over,
        };
        const keys = Object.keys(row);
        return pool.query(
          `insert into payment_refund (${keys.join(", ")})
           values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
          Object.values(row),
        );
      };

      await insert({ idempotency_key: "re_same" });
      expect(await code(insert({ idempotency_key: "re_same" }))).toBe(UNIQUE);
      expect(await code(insert({ amount_pence: 0 }))).toBe(CHECK);
      expect(await code(insert({ amount_pence: -5 }))).toBe(CHECK);
      expect(await code(insert({ currency: "gbp" }))).toBe(CHECK);
      expect(await code(insert({ currency: "GBPX" }))).toBe(TOO_LONG);
      expect(await code(insert({ source: "manual" }))).toBe(CHECK);
      expect(await code(insert({ payment_id: randomUUID() }))).toBe(FOREIGN_KEY);
      for (const source of [
        "card_webhook",
        "group_webhook",
        "staff",
        "blocked_capture",
        "payout_topup",
      ]) {
        await insert({ source });
      }
      // A payment with a refund on record cannot be removed from under it.
      expect(await code(pool.query("delete from payment where id = $1", [paymentId]))).toBe(
        FOREIGN_KEY,
      );
    });
  });
});
