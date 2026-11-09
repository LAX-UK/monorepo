import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  it("copies the refund payout lines that exist when it runs, with their source and amount", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_0344_FOLDER_MILLIS);
      const f = await fixture(pool);
      const card = await f.payment();
      const group = await f.payment();
      const staff = await f.payment();
      const untouched = await f.payment();
      const cardLine = await f.payoutLine({
        paymentId: card,
        amount: "-250.50",
        sourceEventId: "evt_1Nabc",
      });
      const groupLine = await f.payoutLine({
        paymentId: group,
        amount: "-100.00",
        sourceEventId: `evt_1Ndef:${group}`,
      });
      const staffLine = await f.payoutLine({
        paymentId: staff,
        amount: "-600.10",
        sourceEventId: `admin_refund:${staff}`,
      });
      const noEventLine = await f.payoutLine({ paymentId: staff, amount: "-0.01" });
      // Not refunds of a payment: another kind, a refund naming no payment, a zero line.
      await f.payoutLine({ paymentId: untouched, amount: "600.10", kind: "sale" });
      await f.payoutLine({ paymentId: null, amount: "-10.00" });
      await f.payoutLine({ paymentId: untouched, amount: "0.00" });

      await runMigrationsPerTransaction(pool);

      const rows = await pool.query<{
        payment_id: string;
        idempotency_key: string;
        amount_pence: number;
        currency: string;
        source: string;
      }>(
        `select payment_id, idempotency_key, amount_pence, currency, source
         from payment_refund order by amount_pence desc`,
      );
      expect(rows.rows).toEqual([
        {
          payment_id: staff,
          idempotency_key: `backfill:payout_line:${staffLine}`,
          amount_pence: 60_010,
          currency: "GBP",
          source: "staff",
        },
        {
          payment_id: card,
          idempotency_key: `backfill:payout_line:${cardLine}`,
          amount_pence: 25_050,
          currency: "GBP",
          source: "card_webhook",
        },
        {
          payment_id: group,
          idempotency_key: `backfill:payout_line:${groupLine}`,
          amount_pence: 10_000,
          currency: "GBP",
          source: "group_webhook",
        },
        {
          payment_id: staff,
          idempotency_key: `backfill:payout_line:${noEventLine}`,
          amount_pence: 1,
          currency: "GBP",
          source: "staff",
        },
      ]);
    });
  });

  it("changes nothing when its data step runs again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_0344_FOLDER_MILLIS);
      const f = await fixture(pool);
      const paymentId = await f.payment();
      await f.payoutLine({ paymentId, amount: "-50.00", sourceEventId: "evt_again" });
      await runMigrationsPerTransaction(pool);

      const sql = await readFile(
        resolve(import.meta.dirname, "../drizzle/0344_payment_refund.sql"),
        "utf8",
      );
      await pool.query(sql.replaceAll("--> statement-breakpoint", ""));
      const count = await pool.query("select count(*)::int as n from payment_refund");
      expect(count.rows[0]).toEqual({ n: 1 });
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
      for (const source of ["card_webhook", "group_webhook", "staff", "blocked_capture"]) {
        await insert({ source });
      }
      // A payment with a refund on record cannot be removed from under it.
      expect(await code(pool.query("delete from payment where id = $1", [paymentId]))).toBe(
        FOREIGN_KEY,
      );
    });
  });
});
