import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { invoiceDueAt } from "@auction/domain";
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

const TAG = "0319_bid_invoice";

async function readDrizzle(name: string): Promise<string> {
  const sql = await readFile(resolve(import.meta.dirname, "../drizzle", name), "utf8");
  return sql.replaceAll("--> statement-breakpoint", "");
}

/** The journal time of the migration just before this one, so the test follows a renumbering. */
async function previousFolderMillis(): Promise<number> {
  const journal = JSON.parse(await readDrizzle("meta/_journal.json")) as {
    entries: { tag: string; when: number }[];
  };
  const index = journal.entries.findIndex((entry) => entry.tag === TAG);
  const previous = journal.entries[index - 1];
  if (index < 1 || !previous) throw new Error(`${TAG} is not in the journal after another entry`);
  return previous.when;
}

type Fixture = {
  buyer: string;
  seller: string;
  buyerId: string;
  lot: (hammer: string) => Promise<string>;
  pay: (input: {
    lotId: string;
    amount: string;
    status: string;
    createdAt: string;
  }) => Promise<string>;
};

/** Real rows for everything a payment points at, in the database as it was before 0319. */
async function fixture(pool: pg.Pool): Promise<Fixture> {
  const buyerId = `inv-buyer-${randomUUID()}`;
  const buyer = randomUUID();
  const seller = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, $1, $2, true, now(), now())`,
    [buyerId, `${buyerId}@integration.test`],
  );
  for (const [id, kind, subkind] of [
    [buyer, "individual", "private_collector"],
    [seller, "organisation", "gallery"],
  ]) {
    await pool.query(
      `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
       values ($1, $2, $3, $4, $5, 'approved')`,
      [id, `Entity ${kind}`, kind, subkind, buyerId],
    );
  }
  return {
    buyer,
    seller,
    buyerId,
    async lot(hammer) {
      const id = randomUUID();
      await pool.query(
        `insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
           current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
         values ($1, $2, $3, 'english', 100, $4, now() - interval '30 days',
           now() - interval '20 days', 'ended', $5, $6)`,
        [id, seller, `Lot ${id.slice(0, 8)}`, hammer, buyerId, buyer],
      );
      return id;
    },
    async pay({ lotId, amount, status, createdAt }) {
      const id = randomUUID();
      await pool.query(
        `insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
           amount, platform_fee, status, created_at)
         values ($1, $2, $3, $4, $5, $6, 0, $7, $8)`,
        [id, lotId, buyerId, buyer, seller, amount, status, createdAt],
      );
      return id;
    },
  };
}

type InvoiceRow = {
  id: string;
  lot_id: string;
  total_pence: string;
  raised_at: Date;
  due_at: Date;
  source: string;
  voided_at: Date | null;
  currency: string;
};

async function invoices(pool: pg.Pool, lotId: string): Promise<InvoiceRow[]> {
  const { rows } = await pool.query<InvoiceRow>(
    "select * from bid_invoice where lot_id = $1 order by created_at, id",
    [lotId],
  );
  return rows;
}

async function lines(pool: pg.Pool, invoiceId: string) {
  const { rows } = await pool.query<{
    position: number;
    kind: string;
    label: string;
    rate_percent: string | null;
    amount_pence: string;
  }>(
    `select position, kind, label, rate_percent, amount_pence
     from bid_invoice_line where invoice_id = $1 order by position`,
    [invoiceId],
  );
  return rows.map((r) => ({
    position: r.position,
    kind: r.kind,
    label: r.label,
    ratePercent: r.rate_percent,
    amountPence: Number(r.amount_pence),
  }));
}

describe.skipIf(!migrationUrl)("migration 0319 bid invoices", { timeout: 120_000 }, () => {
  it("backfills one invoice per lot and buyer account, with lines that add up", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, await previousFolderMillis());
      const f = await fixture(pool);

      // Priced with a premium: hammer 1000.00, paid 1250.00.
      const priced = await f.lot("1000.00");
      const pricedPayment = await f.pay({
        lotId: priced,
        amount: "1250.00",
        status: "pending",
        createdAt: "2026-03-05T23:30:00Z",
      });
      // Raised in British Summer Time just before midnight UTC: the London day is the next one.
      const summer = await f.lot("200.00");
      await f.pay({
        lotId: summer,
        amount: "250.00",
        status: "pending",
        createdAt: "2026-07-01T23:30:00Z",
      });
      // The first payment was cancelled and a second raised later: one invoice, the original date.
      const retried = await f.lot("500.00");
      const first = await f.pay({
        lotId: retried,
        amount: "625.00",
        status: "cancelled",
        createdAt: "2026-04-01T09:00:00Z",
      });
      const second = await f.pay({
        lotId: retried,
        amount: "625.00",
        status: "pending",
        createdAt: "2026-04-10T09:00:00Z",
      });
      // Paid less than the hammer price: the parts cannot be told apart, so one line.
      const short = await f.lot("1000.00");
      await f.pay({
        lotId: short,
        amount: "800.00",
        status: "captured",
        createdAt: "2026-05-01T10:00:00Z",
      });
      // No premium at all: the hammer price alone.
      const noPremium = await f.lot("300.00");
      await f.pay({
        lotId: noPremium,
        amount: "300.00",
        status: "captured",
        createdAt: "2026-05-02T10:00:00Z",
      });
      // Only a cancelled payment exists: it still decides the invoice.
      const onlyCancelled = await f.lot("100.00");
      await f.pay({
        lotId: onlyCancelled,
        amount: "125.00",
        status: "cancelled",
        createdAt: "2026-05-03T10:00:00Z",
      });

      await runMigrationsPerTransaction(pool);

      const [pricedInvoice] = await invoices(pool, priced);
      expect(await invoices(pool, priced)).toHaveLength(1);
      expect(pricedInvoice).toMatchObject({ source: "legacy_backfill", currency: "GBP" });
      expect(Number(pricedInvoice?.total_pence)).toBe(125_000);
      expect(await lines(pool, pricedInvoice?.id as string)).toEqual([
        {
          position: 1,
          kind: "hammer",
          label: "Hammer price",
          ratePercent: null,
          amountPence: 100_000,
        },
        {
          position: 2,
          kind: "buyers_premium",
          label: "Buyer's premium",
          ratePercent: null,
          amountPence: 25_000,
        },
      ]);

      // The due date is the same one the application works out.
      expect(pricedInvoice?.due_at.toISOString()).toBe(
        invoiceDueAt(new Date("2026-03-05T23:30:00Z")).toISOString(),
      );
      expect(pricedInvoice?.due_at.toISOString()).toBe("2026-03-12T23:59:59.999Z");
      const [summerInvoice] = await invoices(pool, summer);
      expect(summerInvoice?.due_at.toISOString()).toBe(
        invoiceDueAt(new Date("2026-07-01T23:30:00Z")).toISOString(),
      );
      expect(summerInvoice?.due_at.toISOString()).toBe("2026-07-09T22:59:59.999Z");

      // The payment row points at its invoice.
      const linked = await pool.query<{ invoice_id: string }>(
        "select invoice_id from payment where id = $1",
        [pricedPayment],
      );
      expect(linked.rows[0]?.invoice_id).toBe(pricedInvoice?.id);

      // Cancelled then re-created: one invoice, raised on the earliest row's date, both rows linked.
      const retriedInvoices = await invoices(pool, retried);
      expect(retriedInvoices).toHaveLength(1);
      expect(retriedInvoices[0]?.raised_at.toISOString()).toBe("2026-04-01T09:00:00.000Z");
      expect(retriedInvoices[0]?.due_at.toISOString()).toBe(
        invoiceDueAt(new Date("2026-04-01T09:00:00Z")).toISOString(),
      );
      expect(Number(retriedInvoices[0]?.total_pence)).toBe(62_500);
      const retriedLinks = await pool.query<{ id: string; invoice_id: string }>(
        "select id, invoice_id from payment where id = any($1)",
        [[first, second]],
      );
      expect(retriedLinks.rows.map((r) => r.invoice_id)).toEqual([
        retriedInvoices[0]?.id,
        retriedInvoices[0]?.id,
      ]);

      // Paid less than the hammer price: one legacy total line.
      const [shortInvoice] = await invoices(pool, short);
      expect(await lines(pool, shortInvoice?.id as string)).toEqual([
        {
          position: 1,
          kind: "legacy_total",
          label: "Total",
          ratePercent: null,
          amountPence: 80_000,
        },
      ]);

      // A total equal to the hammer price has no premium line.
      const [noPremiumInvoice] = await invoices(pool, noPremium);
      expect((await lines(pool, noPremiumInvoice?.id as string)).map((l) => l.kind)).toEqual([
        "hammer",
      ]);

      const [cancelledInvoice] = await invoices(pool, onlyCancelled);
      expect(Number(cancelledInvoice?.total_pence)).toBe(12_500);

      // Every invoice's lines add up to its total, and every payment points at an invoice.
      const sums = await pool.query<{ ok: boolean }>(
        `select (coalesce(sum(l.amount_pence), 0) = i.total_pence) as ok
         from bid_invoice i left join bid_invoice_line l on l.invoice_id = i.id
         group by i.id, i.total_pence`,
      );
      expect(sums.rows.length).toBeGreaterThan(0);
      expect(sums.rows.every((r) => r.ok)).toBe(true);
      const unlinked = await pool.query("select 1 from payment where invoice_id is null");
      expect(unlinked.rowCount).toBe(0);
    });
  });

  it("voids the invoice of a purchase cancelled by a buyer default", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, await previousFolderMillis());
      const f = await fixture(pool);
      const lotId = await f.lot("400.00");
      const paymentId = await f.pay({
        lotId,
        amount: "500.00",
        status: "cancelled",
        createdAt: "2026-05-01T10:00:00Z",
      });
      await pool.query(
        `insert into buyer_default (lot_id, payment_id, buyer_id, buyer_legal_entity_id,
           seller_legal_entity_id, hammer_price, won_at, reason, outcome)
         values ($1, $2, $3, $4, $5, 400, now(), 'No payment', 'returned_to_inventory')`,
        [lotId, paymentId, f.buyerId, f.buyer, f.seller],
      );

      await runMigrationsPerTransaction(pool);

      const [invoice] = await invoices(pool, lotId);
      expect(invoice?.voided_at).toBeInstanceOf(Date);
    });
  });

  it("is idempotent: running it again changes nothing", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, await previousFolderMillis());
      const f = await fixture(pool);
      const lotId = await f.lot("1000.00");
      await f.pay({
        lotId,
        amount: "1250.00",
        status: "pending",
        createdAt: "2026-03-05T23:30:00Z",
      });
      await runMigrationsPerTransaction(pool);

      const before = await invoices(pool, lotId);
      const beforeLines = await lines(pool, before[0]?.id as string);
      await pool.query(await readDrizzle("0319_bid_invoice.sql"));

      const after = await invoices(pool, lotId);
      expect(after).toEqual(before);
      expect(await lines(pool, after[0]?.id as string)).toEqual(beforeLines);
      const count = await pool.query<{ n: string }>("select count(*)::text as n from bid_invoice");
      expect(count.rows[0]?.n).toBe("1");
    });
  });

  it("allows one live invoice per lot and buyer, and a new one once it is voided", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const lotId = await f.lot("100.00");
      const insert = (voidedAt: string | null) =>
        pool.query(
          `insert into bid_invoice (lot_id, buyer_legal_entity_id, seller_legal_entity_id,
             total_pence, raised_at, due_at, voided_at)
           values ($1, $2, $3, 12500, now(), now(), $4)`,
          [lotId, f.buyer, f.seller, voidedAt],
        );
      await insert(null);
      await expect(insert(null)).rejects.toMatchObject({ code: "23505" });
      await insert("2026-05-01T00:00:00Z");
    });
  });

  it("refuses an invoice that is not in pounds, has no total, or an unknown line kind", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const lotId = await f.lot("100.00");
      const insert = (currency: string, total: number) =>
        pool.query(
          `insert into bid_invoice (lot_id, buyer_legal_entity_id, seller_legal_entity_id,
             currency, total_pence, raised_at, due_at)
           values ($1, $2, $3, $4, $5, now(), now())`,
          [lotId, f.buyer, f.seller, currency, total],
        );
      await expect(insert("EUR", 100)).rejects.toMatchObject({ code: "23514" });
      await expect(insert("GBP", 0)).rejects.toMatchObject({ code: "23514" });
      await insert("GBP", 100);
      const { rows } = await pool.query<{ id: string }>("select id from bid_invoice limit 1");
      await expect(
        pool.query(
          `insert into bid_invoice_line (invoice_id, position, kind, label, amount_pence)
           values ($1, 1, 'tip', 'Tip', 10)`,
          [rows[0]?.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
  });

  it("rolls back cleanly, and can be applied again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      await pool.query(await readDrizzle("0319_rollback.sql"));
      const gone = await pool.query<{ n: string }>(
        `select count(*)::text as n from information_schema.tables
         where table_name in ('bid_invoice', 'bid_invoice_line')`,
      );
      expect(gone.rows[0]?.n).toBe("0");
      const column = await pool.query(
        `select 1 from information_schema.columns
         where table_name = 'payment' and column_name = 'invoice_id'`,
      );
      expect(column.rowCount).toBe(0);

      await pool.query(await readDrizzle("0319_bid_invoice.sql"));
      const back = await pool.query<{ n: string }>(
        `select count(*)::text as n from information_schema.tables
         where table_name in ('bid_invoice', 'bid_invoice_line')`,
      );
      expect(back.rows[0]?.n).toBe("2");
    });
  });
});
