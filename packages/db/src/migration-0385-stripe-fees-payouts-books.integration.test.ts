import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0385_stripe_fees_payouts_books.sql").replace(
  /^--> statement-breakpoint$/gm,
  "",
);
const rollbackBody = read("0385_rollback.sql").replace(/^BEGIN;$|^COMMIT;$/gm, "");

/** Everything runs inside one transaction that is rolled back at the end. */
describe.skipIf(!url)(
  "migration 0385 Stripe fees and payouts (database)",
  { timeout: 60_000 },
  () => {
    let client: pg.Client;
    const attempt = async (sql: string, params: unknown[] = []): Promise<string | null> => {
      await client.query("savepoint s");
      try {
        await client.query(sql, params);
        await client.query("release savepoint s");
        return null;
      } catch (err) {
        await client.query("rollback to savepoint s");
        return (err as { code?: string }).code ?? "unknown";
      }
    };
    const txn = (id: string, extra: Record<string, unknown> = {}) => {
      const row = {
        type: "charge",
        outcome: "booked",
        product: "shop",
        park_reason: null,
        booked_fee_pence: 165,
        booked_payout_pence: 0,
        ...extra,
      };
      return attempt(
        `insert into accounting_stripe_balance_txn
         (stripe_account_id, balance_transaction_id, type, currency, amount_pence, fee_pence,
          created_at_stripe, created_on, product, outcome, park_reason, booked_fee_pence,
          booked_payout_pence, read_at)
       values ('acct_M0385', $1, $2, 'gbp', 10000, 165, now(), current_date, $3, $4, $5, $6, $7, now())`,
        [
          id,
          row.type,
          row.product,
          row.outcome,
          row.park_reason,
          row.booked_fee_pence,
          row.booked_payout_pence,
        ],
      );
    };

    beforeAll(async () => {
      client = new Client(buildPgConnectionConfig(url as string));
      await client.connect();
      await client.query("begin");
      // Down and up again, as a deploy after a rollback would.
      await client.query(rollbackBody);
      await client.query(migration);
      await client.query(
        "insert into accounting_stripe_account (stripe_account_id, product) values ('acct_M0385', 'shop')",
      );
    });

    afterAll(async () => {
      await client.query("rollback");
      await client.end();
    });

    it("holds one row per balance transaction, and refuses to change or remove one", async () => {
      expect(await txn("txn_M0385a")).toBeNull();
      expect(await txn("txn_M0385a")).toBe("23505");
      expect(await attempt("update accounting_stripe_balance_txn set fee_pence = 1")).toBe("42501");
      expect(await attempt("delete from accounting_stripe_balance_txn")).toBe("42501");
    });

    it("allows a parked row only with a reason, and a booked row only when it books something", async () => {
      expect(
        await txn("txn_M0385b", { outcome: "parked", product: null, booked_fee_pence: 0 }),
      ).toBe("23514");
      expect(
        await txn("txn_M0385c", {
          outcome: "parked",
          product: null,
          park_reason: "unattributable",
          booked_fee_pence: 0,
        }),
      ).toBeNull();
      expect(await txn("txn_M0385d", { booked_fee_pence: 0 })).toBe("23514");
      expect(await txn("txn_M0385e", { product: null })).toBe("23514");
      expect(await txn("bad_M0385")).toBe("23514");
    });

    it("stores an expense and a transfer without VAT, under references of their own kind", async () => {
      const insert = (kind: string, reference: string, vat: number) =>
        attempt(
          `insert into accounting_document
           (product, legal_entity, kind, lax_reference, source_event_ref, payload,
            net_pence, vat_pence, gross_pence)
         values ('shop', 'london_art_exchange', $1, $2, 'stripe:test', '{}'::jsonb, 100, $3::bigint, 100 + $3::bigint)`,
          [kind, reference, vat],
        );
      expect(await insert("expense", "LAX-SHOP-EXP-txn_1-a", 0)).toBeNull();
      expect(await insert("transfer", "LAX-SHOP-TRF-po_1-a", 0)).toBeNull();
      expect(await insert("expense", "LAX-SHOP-EXP-txn_2", 20)).toBe("23514");
      expect(await insert("expense", "LAX-SHOP-TRF-po_2", 0)).toBe("23514");
    });

    it("answers which Shop order holds a PaymentIntent, as its owner, with the order id only", async () => {
      const fn = await client.query<{ prosecdef: boolean; proconfig: string[]; returns: string }>(
        `select prosecdef, proconfig, prorettype::regtype::text as returns
           from pg_proc where oid = 'public.accounting_stripe_shop_order(text)'::regprocedure`,
      );
      // A definer function with its search path fixed, so no caller's schema can stand in.
      expect(fn.rows).toEqual([
        { prosecdef: true, proconfig: ["search_path=pg_catalog, public"], returns: "uuid" },
      ]);
      const order = await client.query<{ id: string }>(
        `insert into shop_order (identity_subject_id, fulfilment, merchandise_subtotal_pence,
                                 fulfilment_surcharge_pence, total_pence, idempotency_key,
                                 stripe_payment_intent_id)
         values ('m0385', 'uk_insured_delivery', 100, 0, 100, 'm0385', 'pi_M0385') returning id`,
      );
      const found = await client.query<{ id: string | null }>(
        "select accounting_stripe_shop_order($1) as id",
        ["pi_M0385"],
      );
      expect(found.rows[0]?.id).toBe(order.rows[0]?.id);
      const missing = await client.query<{ id: string | null }>(
        "select accounting_stripe_shop_order($1) as id",
        ["pi_M0385_none"],
      );
      expect(missing.rows[0]?.id).toBeNull();
    });

    it("stores reports under the private reconciliation prefix only", async () => {
      const report = (key: string) =>
        attempt(
          `insert into accounting_reconciliation_report
           (legal_entity, report_day, storage_key, mismatches, generated_at)
         values ('london_art_exchange', '2026-11-13', $1, 0, now())`,
          [key],
        );
      expect(await report("reports/public.json")).toBe("23514");
      expect(
        await report("accounting/reconciliation/london_art_exchange/2026-11-13/run-1.json"),
      ).toBeNull();
    });
  },
);
