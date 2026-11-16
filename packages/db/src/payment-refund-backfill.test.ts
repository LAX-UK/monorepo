import { describe, expect, it } from "vitest";
import {
  BACKFILL_ONE_PAYMENT_SQL,
  LOCK_NEXT_REFUND_PAYMENTS_SQL,
  type PaymentRefundBackfillConnection,
  PaymentRefundBackfillError,
  PaymentRefundBackfillLockTimeoutError,
  REPORT_REFUND_GAPS_SQL,
  SET_BATCH_LOCK_TIMEOUT_SQL,
  backfillPaymentRefundsInIdOrder,
  reportPaymentRefundGaps,
} from "./payment-refund-backfill.js";

type Call = { text: string; values?: unknown[] };

/** A connection over sorted payment ids, as Postgres would return them for the lock query. */
function fakeConnection(
  ids: readonly string[],
  opts: { failOn?: string; code?: string; added?: (id: string) => number } = {},
) {
  const calls: Call[] = [];
  const connection: PaymentRefundBackfillConnection = {
    async query(text, values) {
      calls.push({ text, values });
      if (text === LOCK_NEXT_REFUND_PAYMENTS_SQL) {
        const [after, limit] = values as [string | null, number];
        return {
          rows: ids
            .filter((id) => after === null || id > after)
            .slice(0, limit)
            .map((id) => ({ id })),
        };
      }
      if (text === BACKFILL_ONE_PAYMENT_SQL) {
        const id = (values as [string])[0];
        if (id === opts.failOn) {
          throw Object.assign(new Error("boom"), opts.code ? { code: opts.code } : {});
        }
        return { rows: [{ added: opts.added?.(id) ?? 1 }] };
      }
      return { rows: [] };
    },
  };
  return { connection, calls };
}

const summary = (calls: Call[]) =>
  calls.map((c) =>
    c.text === LOCK_NEXT_REFUND_PAYMENTS_SQL
      ? `lock after=${c.values?.[0]} limit=${c.values?.[1]}`
      : c.text === BACKFILL_ONE_PAYMENT_SQL
        ? `topup ${c.values?.[0]}`
        : c.text === SET_BATCH_LOCK_TIMEOUT_SQL
          ? `timeout ${c.values?.[0]}`
          : c.text,
  );

describe("backfillPaymentRefundsInIdOrder", () => {
  it("locks payments in id order with one statement per batch", () => {
    expect(LOCK_NEXT_REFUND_PAYMENTS_SQL).toMatch(
      /ORDER BY p\."id"\s+LIMIT \$2\s+FOR NO KEY UPDATE OF p$/,
    );
    expect(LOCK_NEXT_REFUND_PAYMENTS_SQL).toContain('p."id" > $1::uuid');
    expect(BACKFILL_ONE_PAYMENT_SQL).toContain(
      "payment_refund_backfill_from_payout_lines($1::uuid)",
    );
  });

  it("tops up each locked payment in id order, a batch per transaction, resuming after the last id", async () => {
    const { connection, calls } = fakeConnection(["a", "b", "c", "d", "e"]);
    const batches: string[][] = [];
    const result = await backfillPaymentRefundsInIdOrder(connection, {
      batchSize: 2,
      onBatch: (b) => batches.push([...b.paymentIds]),
    });
    expect(summary(calls)).toEqual([
      "BEGIN",
      "timeout 5000ms",
      "lock after=null limit=2",
      "topup a",
      "topup b",
      "COMMIT",
      "BEGIN",
      "timeout 5000ms",
      "lock after=b limit=2",
      "topup c",
      "topup d",
      "COMMIT",
      "BEGIN",
      "timeout 5000ms",
      "lock after=d limit=2",
      "topup e",
      "COMMIT",
    ]);
    expect(batches).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(result).toEqual({ batches: 3, payments: 5, added: 5 });
  });

  it("stops after an empty batch when the last one was full", async () => {
    const { connection, calls } = fakeConnection(["a", "b"], { added: () => 0 });
    const result = await backfillPaymentRefundsInIdOrder(connection, { batchSize: 2 });
    expect(summary(calls).slice(-4)).toEqual([
      "BEGIN",
      "timeout 5000ms",
      "lock after=b limit=2",
      "COMMIT",
    ]);
    expect(result).toEqual({ batches: 1, payments: 2, added: 0 });
  });

  it("rolls the batch back and stops on an error", async () => {
    const { connection, calls } = fakeConnection(["a", "b", "c"], { failOn: "b" });
    await expect(backfillPaymentRefundsInIdOrder(connection, { batchSize: 5 })).rejects.toThrow(
      "boom",
    );
    expect(summary(calls)).toEqual([
      "BEGIN",
      "timeout 5000ms",
      "lock after=null limit=5",
      "topup a",
      "topup b",
      "ROLLBACK",
    ]);
  });

  it("reports the resume cursor for any failure, not only a lock timeout", async () => {
    const { connection } = fakeConnection(["a", "b", "c", "d"], { failOn: "c" });
    const error = await backfillPaymentRefundsInIdOrder(connection, { batchSize: 2 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PaymentRefundBackfillError);
    expect(error).not.toBeInstanceOf(PaymentRefundBackfillLockTimeoutError);
    const failure = error as PaymentRefundBackfillError;
    expect(failure.batch).toBe(2);
    expect(failure.resumeAfter).toBe("b");
    expect(failure.completed).toEqual({ batches: 1, payments: 2, added: 2 });
    expect(failure.message).toContain("boom");
    expect(failure.message).toContain("--resume-after=b");
    expect((failure.cause as Error).message).toBe("boom");
  });

  it("reports no cursor when the first batch fails", async () => {
    const { connection } = fakeConnection(["a"], { failOn: "a" });
    const error = (await backfillPaymentRefundsInIdOrder(connection).catch(
      (e: unknown) => e,
    )) as PaymentRefundBackfillError;
    expect(error).toBeInstanceOf(PaymentRefundBackfillError);
    expect(error.resumeAfter).toBeNull();
    expect(error.message).toContain("nothing was committed");
  });

  it("sets the lock timeout in each batch and reports a lock timeout with its cursor", async () => {
    const { connection, calls } = fakeConnection(["a", "b", "c"], { failOn: "c", code: "55P03" });
    const error = await backfillPaymentRefundsInIdOrder(connection, {
      batchSize: 2,
      lockTimeoutMs: 250,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(PaymentRefundBackfillLockTimeoutError);
    expect(error.batch).toBe(2);
    expect(error.resumeAfter).toBe("b");
    expect(error.completed).toEqual({ batches: 1, payments: 2, added: 2 });
    expect(error.message).toContain("--resume-after=b");
    expect(summary(calls).filter((c) => c.startsWith("timeout"))).toEqual([
      "timeout 250ms",
      "timeout 250ms",
    ]);
    expect(summary(calls).at(-1)).toBe("ROLLBACK");
  });

  it("starts after resumeAfter", async () => {
    const { connection, calls } = fakeConnection(["a", "b", "c"]);
    await backfillPaymentRefundsInIdOrder(connection, { resumeAfter: "a" });
    expect(summary(calls)[2]).toBe("lock after=a limit=200");
  });

  it("refuses a batch size that is not a whole number above zero", async () => {
    const { connection } = fakeConnection([]);
    for (const batchSize of [0, -1, 1.5]) {
      await expect(backfillPaymentRefundsInIdOrder(connection, { batchSize })).rejects.toThrow(
        RangeError,
      );
    }
  });
});

describe("reportPaymentRefundGaps", () => {
  it("reads the per-payment difference in one statement, with no transaction or lock", async () => {
    expect(REPORT_REFUND_GAPS_SQL).not.toMatch(/FOR (NO KEY )?UPDATE|FOR (KEY )?SHARE/);
    const calls: Call[] = [];
    const connection: PaymentRefundBackfillConnection = {
      async query(text, values) {
        calls.push({ text, values });
        return {
          rows: [
            {
              payment_id: "a",
              line_pence: "10000",
              recorded_pence: "4000",
              difference_pence: "6000",
              topup_key_exists: false,
            },
            {
              payment_id: "b",
              line_pence: "500",
              recorded_pence: "800",
              difference_pence: "-300",
              topup_key_exists: false,
            },
            {
              payment_id: "c",
              line_pence: "900",
              recorded_pence: "400",
              difference_pence: "500",
              topup_key_exists: true,
            },
          ],
        };
      },
    };
    expect(await reportPaymentRefundGaps(connection)).toEqual([
      {
        paymentId: "a",
        linePence: 10_000,
        recordedPence: 4_000,
        differencePence: 6_000,
        topupKeyExists: false,
        wouldTopUp: true,
      },
      {
        paymentId: "b",
        linePence: 500,
        recordedPence: 800,
        differencePence: -300,
        topupKeyExists: false,
        wouldTopUp: false,
      },
      {
        paymentId: "c",
        linePence: 900,
        recordedPence: 400,
        differencePence: 500,
        topupKeyExists: true,
        wouldTopUp: false,
      },
    ]);
    expect(calls).toEqual([{ text: REPORT_REFUND_GAPS_SQL, values: [null] }]);
  });
});
