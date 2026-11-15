import { randomUUID } from "node:crypto";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import {
  PaymentRefundBackfillLockTimeoutError,
  backfillPaymentRefundsInIdOrder,
  reportPaymentRefundGaps,
} from "./payment-refund-backfill.js";
import {
  migrationTestDatabaseUrl as migrationUrl,
  withTemporaryDatabase,
} from "./testing/temporary-database.js";

async function seedPayments(pool: pg.Pool, count: number): Promise<string[]> {
  const one = async (text: string, values: unknown[] = []) =>
    (await pool.query<{ id: string }>(text, values)).rows[0]?.id as string;
  const userId = `refund-backfill-${randomUUID()}`;
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
  const ids = Array.from({ length: count }, () => randomUUID()).sort();
  // Inserted in descending id order, so the heap order is not the id order: a lock query without
  // its ORDER BY would visit (and lock) payments out of order.
  for (const id of [...ids].reverse()) {
    const lotId = await one(
      `insert into lot (sale_id, title, auction_type, starting_price, current_price, start_time, end_time, seller_legal_entity_id)
       values ($1, 'Lot', 'english', 0, 0, now(), now() + interval '1 day', $2) returning id`,
      [saleId, sellerId],
    );
    await pool.query(
      `insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id, amount, platform_fee)
       values ($1, $2, $3, $4, $5, 1000, 180)`,
      [id, lotId, userId, buyerId, sellerId],
    );
  }
  const payoutId = await one(
    `insert into payout (legal_entity_id, period_start, period_end, gross_amount, platform_fee, stripe_fee, net_amount)
     values ($1, now() - interval '1 day', now(), 0, 0, 0, 0) returning id`,
    [sellerId],
  );
  // Refunds the previous release made: a payout line each and no payment_refund row yet.
  for (const id of ids) {
    await refundLine(pool, payoutId, id, "-100.00");
  }
  return ids;
}

async function refundLine(
  db: Pick<pg.Pool, "query">,
  payoutId: string,
  paymentId: string,
  amount: string,
): Promise<void> {
  await db.query(
    `insert into payout_line (payout_id, payment_id, amount, kind, source_event_id)
     values ($1, $2, $3, 'refund', $4)`,
    [payoutId, paymentId, amount, `evt_${randomUUID()}`],
  );
}

const rowsOf = async (pool: pg.Pool, paymentId: string) =>
  (
    await pool.query<{ idempotency_key: string; amount_pence: number; source: string }>(
      `select idempotency_key, amount_pence, source from payment_refund
        where payment_id = $1 order by source, idempotency_key`,
      [paymentId],
    )
  ).rows;

/** A live refund grows the payment's refund line in place (one per payout, payment and kind). */
async function growRefundLine(db: Pick<pg.Pool, "query">, paymentId: string, pounds: string) {
  await db.query(
    `update payout_line set amount = amount - $2::numeric, source_event_id = $3
      where payment_id = $1 and kind = 'refund'`,
    [paymentId, pounds, `evt_${randomUUID()}`],
  );
}

const showLockTimeout = async (db: Pick<pg.Pool, "query">) =>
  (await db.query<{ lock_timeout: string }>("show lock_timeout")).rows[0]?.lock_timeout;

async function isWaitingOnLock(pool: pg.Pool, pid: number): Promise<boolean> {
  const { rows } = await pool.query<{ waiting: boolean }>(
    `select wait_event_type = 'Lock' as waiting from pg_stat_activity where pid = $1`,
    [pid],
  );
  return rows[0]?.waiting === true;
}

async function waitUntilBlockedOnLock(pool: pg.Pool, pid: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await isWaitingOnLock(pool, pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("The backfill never waited for the live refund's payment lock");
}

const backendPid = async (client: pg.PoolClient) =>
  (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]?.pid as number;

describe.skipIf(!migrationUrl)(
  "payment_refund global backfill in id order",
  { timeout: 120_000 },
  () => {
    it("runs beside a live refund on overlapping payments without deadlock or a lost refund", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        const [a, b, c] = (await seedPayments(pool, 3)) as [string, string, string];
        expect(await rowsOf(pool, a)).toEqual([]);

        const live = await pool.connect();
        const backfill = await pool.connect();
        try {
          // A live refund of B: the payment's lock, the per-payment top-up, then its own record.
          await live.query("begin");
          await live.query("select id from payment where id = $1 for update", [b]);
          await live.query("select payment_refund_backfill_from_payout_lines($1::uuid)", [b]);
          await growRefundLine(live, b, "50.00");
          await live.query(
            `insert into payment_refund (payment_id, idempotency_key, amount_pence, currency, source)
           values ($1, 'evt_live_b', 5000, 'GBP', 'card_webhook')`,
            [b],
          );

          // One batch spans A..C, so the run holds A while it waits for B. Only the ascending
          // lock order keeps it off C until then; locking C first would deadlock with the live
          // transaction's next step.
          const pid = await backendPid(backfill);
          const run = backfillPaymentRefundsInIdOrder(backfill, { batchSize: 3 });
          await waitUntilBlockedOnLock(pool, pid);
          expect(await rowsOf(pool, a)).toEqual([]);
          expect(await rowsOf(pool, c)).toEqual([]);

          // The same live transaction goes on to C (a higher id): the backfill has not locked it.
          await live.query("select id from payment where id = $1 for update", [c]);
          await live.query("select payment_refund_backfill_from_payout_lines($1::uuid)", [c]);
          await growRefundLine(live, c, "30.00");
          await live.query(
            `insert into payment_refund (payment_id, idempotency_key, amount_pence, currency, source)
           values ($1, 'evt_live_c', 3000, 'GBP', 'card_webhook')`,
            [c],
          );
          await live.query("commit");

          expect(await run).toEqual({ batches: 1, payments: 3, added: 1 });
        } finally {
          live.release();
          backfill.release();
        }

        expect(await rowsOf(pool, a)).toEqual([
          {
            idempotency_key: `payout_ledger_topup:${a}:10000`,
            amount_pence: 10_000,
            source: "payout_topup",
          },
        ]);
        expect(await rowsOf(pool, b)).toEqual([
          { idempotency_key: "evt_live_b", amount_pence: 5_000, source: "card_webhook" },
          {
            idempotency_key: `payout_ledger_topup:${b}:10000`,
            amount_pence: 10_000,
            source: "payout_topup",
          },
        ]);
        expect(await rowsOf(pool, c)).toEqual([
          { idempotency_key: "evt_live_c", amount_pence: 3_000, source: "card_webhook" },
          {
            idempotency_key: `payout_ledger_topup:${c}:10000`,
            amount_pence: 10_000,
            source: "payout_topup",
          },
        ]);
        // Every payment's record now equals its refund lines, and a re-run adds nothing.
        const { rows: gaps } = await pool.query(
          `select l.payment_id
           from payout_line l
          where l.kind = 'refund'
          group by l.payment_id
         having sum(round(-l.amount * 100)) <>
                (select coalesce(sum(r.amount_pence), 0) from payment_refund r where r.payment_id = l.payment_id)`,
        );
        expect(gaps).toEqual([]);
        const again = await pool.connect();
        try {
          expect(await backfillPaymentRefundsInIdOrder(again, { batchSize: 2 })).toEqual({
            batches: 2,
            payments: 3,
            added: 0,
          });
        } finally {
          again.release();
        }
      });
    });

    it("does not block a dispute's allocation insert, which key-shares payments out of id order", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        const [a, b, c] = (await seedPayments(pool, 3)) as [string, string, string];
        const sellerId = (
          await pool.query<{ seller: string }>(
            "select seller_legal_entity_id as seller from payment where id = $1",
            [a],
          )
        ).rows[0]?.seller as string;

        const dispute = await pool.connect();
        const backfill = await pool.connect();
        try {
          // As insertAllocationsInTransaction does for lines in createdAt or staff order: the
          // foreign key to payment takes FOR KEY SHARE on B, and later on A.
          await dispute.query("begin");
          const caseId = (
            await dispute.query<{ id: string }>(
              `insert into dispute_case (stripe_dispute_id, stripe_charge_id, amount_pence, currency, status,
                 allocation_state, stripe_created_at, last_event_at)
               values ($1, 'ch_group', 400, 'gbp', 'needs_response', 'allocated', now(), now())
               returning id`,
              [`dp_${randomUUID()}`],
            )
          ).rows[0]?.id as string;
          const allocate = (paymentId: string) =>
            dispute.query(
              `insert into dispute_allocation (case_id, payment_id, seller_legal_entity_id, amount_pence,
                 seller_share_pence, source)
               values ($1, $2, $3, 200, 0, 'automatic')`,
              [caseId, paymentId, sellerId],
            );
          await allocate(b);

          // The run locks A..C in one batch. With FOR UPDATE it would hold A and wait for B's key
          // share, and the dispute's next insert (A) would close the cycle: deadlock detected.
          const pid = await backendPid(backfill);
          let settled = false;
          const run = backfillPaymentRefundsInIdOrder(backfill, { batchSize: 3 }).finally(() => {
            settled = true;
          });
          while (!settled && !(await isWaitingOnLock(pool, pid))) {
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          await allocate(a);
          // The dispute then locks its payments in id order, as lockPaymentsInTransaction does.
          await dispute.query(
            "select id from payment where id = any($1::uuid[]) order by id for update",
            [[a, b]],
          );
          await dispute.query("commit");
          expect(await run).toEqual({ batches: 1, payments: 3, added: 3 });
        } finally {
          dispute.release();
          backfill.release();
        }

        const { rows } = await pool.query<{ payment_id: string }>(
          "select payment_id from dispute_allocation order by payment_id",
        );
        expect(rows.map((r) => r.payment_id)).toEqual([a, b]);
        for (const id of [a, b, c]) {
          expect(await rowsOf(pool, id)).toEqual([
            {
              idempotency_key: `payout_ledger_topup:${id}:10000`,
              amount_pence: 10_000,
              source: "payout_topup",
            },
          ]);
        }
      });
    });

    it("covers every payment with refund lines across batches, once", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        const ids = await seedPayments(pool, 5);
        const client = await pool.connect();
        const before = await showLockTimeout(client);
        try {
          const seen: string[] = [];
          const result = await backfillPaymentRefundsInIdOrder(client, {
            batchSize: 2,
            onBatch: (batch) => seen.push(...batch.paymentIds),
          });
          expect(seen).toEqual(ids);
          expect(result).toEqual({ batches: 3, payments: 5, added: 5 });
          // lock_timeout was set per transaction only: the connection's own setting is unchanged.
          expect(await showLockTimeout(client)).toBe(before);
        } finally {
          client.release();
        }
        for (const id of ids) {
          expect(await rowsOf(pool, id)).toEqual([
            {
              idempotency_key: `payout_ledger_topup:${id}:10000`,
              amount_pence: 10_000,
              source: "payout_topup",
            },
          ]);
        }
      });
    });

    it("times out cleanly on a payment lock held elsewhere: batch rolled back, cursor reported", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        const [a, b, c] = (await seedPayments(pool, 3)) as [string, string, string];
        const holder = await pool.connect();
        const backfill = await pool.connect();
        const before = await showLockTimeout(backfill);
        try {
          // Batch size 2: batch 1 (A, B) commits; batch 2 (C) waits on the holder's lock.
          await holder.query("begin");
          await holder.query("select id from payment where id = $1 for update", [c]);
          const error = await backfillPaymentRefundsInIdOrder(backfill, {
            batchSize: 2,
            lockTimeoutMs: 300,
          }).catch((e) => e);
          expect(error).toBeInstanceOf(PaymentRefundBackfillLockTimeoutError);
          expect(error.batch).toBe(2);
          expect(error.resumeAfter).toBe(b);
          expect(error.completed).toEqual({ batches: 1, payments: 2, added: 2 });
          expect(await showLockTimeout(backfill)).toBe(before);
          expect(error.message).toContain(`--resume-after=${b}`);
          // The connection is usable again: the failed batch was rolled back, not left open.
          expect((await backfill.query("select txid_current_if_assigned() as t")).rows[0].t).toBe(
            null,
          );
        } finally {
          await holder.query("rollback");
          holder.release();
          backfill.release();
        }
        expect((await rowsOf(pool, a)).length).toBe(1);
        expect((await rowsOf(pool, b)).length).toBe(1);
        expect(await rowsOf(pool, c)).toEqual([]);

        // Resuming from the cursor finishes the rest.
        const again = await pool.connect();
        try {
          expect(
            await backfillPaymentRefundsInIdOrder(again, { batchSize: 2, resumeAfter: b }),
          ).toEqual({ batches: 1, payments: 1, added: 1 });
        } finally {
          again.release();
        }
        expect((await rowsOf(pool, c)).length).toBe(1);
      });
    });

    it("writes nothing when the batch times out in its lock query (before any per-payment call)", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        const [a, , c] = (await seedPayments(pool, 3)) as [string, string, string];
        const holder = await pool.connect();
        const backfill = await pool.connect();
        const before = await showLockTimeout(backfill);
        try {
          await holder.query("begin");
          await holder.query("select id from payment where id = $1 for update", [c]);
          const error = await backfillPaymentRefundsInIdOrder(backfill, {
            batchSize: 3,
            lockTimeoutMs: 300,
          }).catch((e) => e);
          expect(error).toBeInstanceOf(PaymentRefundBackfillLockTimeoutError);
          expect(error.batch).toBe(1);
          expect(error.resumeAfter).toBeNull();
          expect(error.completed).toEqual({ batches: 0, payments: 0, added: 0 });
          expect(await showLockTimeout(backfill)).toBe(before);
        } finally {
          await holder.query("rollback");
          holder.release();
          backfill.release();
        }
        const { rows } = await pool.query("select 1 from payment_refund");
        expect(rows).toEqual([]);
        expect(await rowsOf(pool, a)).toEqual([]);
      });
    });

    it("rolls back per-payment inserts already made when a later step in the same batch times out", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        const [a, b] = (await seedPayments(pool, 2)) as [string, string];
        const holder = await pool.connect();
        const backfill = await pool.connect();
        const before = await showLockTimeout(backfill);
        try {
          // The holder has an uncommitted row under the key the function will insert for B. The lock
          // query passes (the holder takes no payment lock beyond a key share), A is topped up, and
          // the function's insert for B then waits on the holder's unique-index entry until
          // lock_timeout fires: a timeout after one per-payment call in the same batch.
          await holder.query("begin");
          await holder.query(
            `insert into payment_refund (payment_id, idempotency_key, amount_pence, currency, source)
             values ($1, $2, 10000, 'GBP', 'payout_topup')`,
            [b, `payout_ledger_topup:${b}:10000`],
          );
          const error = await backfillPaymentRefundsInIdOrder(backfill, {
            batchSize: 2,
            lockTimeoutMs: 300,
          }).catch((e) => e);
          expect(error).toBeInstanceOf(PaymentRefundBackfillLockTimeoutError);
          expect(error.batch).toBe(1);
          expect(error.resumeAfter).toBeNull();
          expect(await showLockTimeout(backfill)).toBe(before);
        } finally {
          await holder.query("rollback");
          holder.release();
          backfill.release();
        }
        // A's top-up was made inside the batch transaction and rolled back with it.
        expect(await rowsOf(pool, a)).toEqual([]);
        expect(await rowsOf(pool, b)).toEqual([]);
      });
    });

    it("dry run honours resumeAfter: only ids after the cursor", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        const [a, b, c] = (await seedPayments(pool, 3)) as [string, string, string];
        expect((await reportPaymentRefundGaps(pool)).map((g) => g.paymentId)).toEqual([a, b, c]);
        expect(
          (await reportPaymentRefundGaps(pool, { resumeAfter: a })).map((g) => g.paymentId),
        ).toEqual([b, c]);
        expect(await reportPaymentRefundGaps(pool, { resumeAfter: c })).toEqual([]);
      });
    });

    it("dry run does not call a payment with an existing top-up key a top-up", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransaction(pool);
        const [a, b] = (await seedPayments(pool, 2)) as [string, string];
        // A payment whose top-up key exists although the recorded total is below the lines (a
        // different currency row does not count), so the gap is positive yet --apply inserts nothing.
        await pool.query(
          `insert into payment_refund (payment_id, idempotency_key, amount_pence, currency, source)
           values ($1, $2, 10000, 'EUR', 'payout_topup')`,
          [b, `payout_ledger_topup:${b}:10000`],
        );
        const gaps = await reportPaymentRefundGaps(pool);
        expect(
          gaps.map((g) => [g.paymentId, g.differencePence, g.topupKeyExists, g.wouldTopUp]),
        ).toEqual([
          [a, 10_000, false, true],
          [b, 10_000, true, false],
        ]);
        const client = await pool.connect();
        try {
          const result = await backfillPaymentRefundsInIdOrder(client);
          expect(result.added).toBe(gaps.filter((g) => g.wouldTopUp).length);
        } finally {
          client.release();
        }
      });
    });
  },
);
