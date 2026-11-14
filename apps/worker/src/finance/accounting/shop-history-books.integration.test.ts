import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import type { Database } from "@auction/db";
import {
  DrizzleShopAccountingFactsReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DrizzleBooksHistoryReader } from "../../repositories/drizzle-books-history.reader.js";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { BooksBackfill } from "./books-backfill.service.js";
import { ShopHistoryImport } from "./shop-history-import.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);

/** Synthetic fixtures only. Each case gets its own month in the past, so runs never overlap. */
function window() {
  const year = 1950 + Math.floor(Math.random() * 40);
  const month = Math.floor(Math.random() * 12);
  const since = new Date(Date.UTC(year, month, 1));
  return {
    since,
    before: new Date(Date.UTC(year, month, 28)),
    paidAt: (d: number) => new Date(Date.UTC(year, month, d, 12)),
  };
}

/** A paid Shop order, one print collected in London, paid at `paidAt`; the database numbers it. */
async function seedPaidOrder(db: Database, paidAt: Date, partyId?: string) {
  const tag = randomUUID().slice(0, 8);
  const subject = `shop-history-${tag}`;
  const party =
    partyId ??
    ((
      await db.execute<{ id: string }>(
        sql`insert into shop_party (display_name, kind) values (${`Buyer ${tag}`}, 'person') returning id`,
      )
    ).rows[0]?.id as string);
  const product = await db.execute<{ id: string }>(
    sql`insert into shop_product (slug, title) values (${`hist-${tag}`}, ${`Print ${tag}`}) returning id`,
  );
  const variant = await db.execute<{ id: string }>(
    sql`insert into shop_product_variant (product_id, sku, price_pence)
        values (${product.rows[0]?.id}, ${`HIST-${tag}`}, 30000) returning id`,
  );
  await db.execute(
    sql`insert into shop_user_profile (identity_subject_id, email, name)
        values (${subject}, ${`${subject}@integration.test`}, ${`Ada ${tag}`})`,
  );
  const order = await db.execute<{ id: string }>(
    sql`insert into shop_order
          (identity_subject_id, fulfilment, merchandise_subtotal_pence, framing_subtotal_pence,
           fulfilment_surcharge_pence, fulfilment_vat_pence, total_pence, idempotency_key, buyer_party_id)
        values (${subject}, 'collect_brunswick', 30000, 0, 0, null, 30000, ${`hist-${tag}`}, ${party})
        returning id`,
  );
  const orderId = order.rows[0]?.id as string;
  await db.execute(
    sql`insert into shop_order_line (order_id, product_variant_id, unit_price_pence)
        values (${orderId}, ${variant.rows[0]?.id}, 30000)`,
  );
  await db.execute(
    sql`update shop_order set status = 'paid', paid_at = ${paidAt.toISOString()}::timestamptz where id = ${orderId}`,
  );
  const numbered = await db.execute<{ invoice_number: string }>(
    sql`select invoice_number from shop_order where id = ${orderId}`,
  );
  return { orderId, partyId: party, invoiceNumber: numbered.rows[0]?.invoice_number as string };
}

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)(
  "Shop history import and backfill (integration)",
  { timeout: 60_000 },
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const owner = createDb(OWNER_URL!);
    const worker = createDb(WORKER_URL || (OWNER_URL as string));

    afterAll(async () => {
      await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
      await closeDb(owner);
      await closeDb(worker);
    });

    async function aim(shop: string, bid = "off") {
      await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then ${bid === "off" ? "live" : "off"} else 'off' end,
             books_mode = case product when 'shop' then ${shop} when 'bid' then ${bid} else 'off' end`);
    }

    /** The import as the command builds it, as worker_app, on a day of its own (its budget day). */
    function importer(day = new Date(Date.UTC(2090, 0, 1 + Math.floor(Math.random() * 3000)))) {
      const repos = createAccountingRepositories(worker, { now: () => day });
      return new ShopHistoryImport({
        history: new DrizzleBooksHistoryReader(worker),
        shopFacts: new DrizzleShopAccountingFactsReader(worker),
        settings: repos.settingReader,
        registry: repos.registry,
        lookup: repos.lookup,
        now: () => day,
      });
    }

    async function documentsOf(orderIds: string[]) {
      const rows = await owner.execute<{
        product: string;
        kind: string;
        lax_reference: string;
        state: string;
        target_mode: string;
        number: string | null;
      }>(sql`
      select product, kind, lax_reference, state, target_mode, payload->>'number' as number
        from accounting_document
       where source_event_ref in (${sql.join(
         orderIds.map((id) => sql`${`shop_history_import:${id}`}`),
         sql`, `,
       )})
       order by lax_reference`);
      return rows.rows;
    }

    it("dry run writes nothing; the import queues contacts and numbered invoices once; a re-run queues nothing", async () => {
      await aim("dry_run");
      const w = window();
      const a = await seedPaidOrder(owner, w.paidAt(3));
      const b = await seedPaidOrder(owner, w.paidAt(4), a.partyId);
      const c = await seedPaidOrder(owner, w.paidAt(5));
      const ids = [a.orderId, b.orderId, c.orderId];
      const run = importer();
      const base = { since: w.since, before: w.before, maxDocuments: 100 };

      const dry = await run.run({ ...base, dryRun: true });
      expect(dry.wouldQueue).toEqual({ contact: 2, invoice: 3 });
      expect(dry.invoiceGrossPence).toBe(90_000);
      expect(dry.firstNumber).toBe(a.invoiceNumber);
      expect(dry.lastNumber).toBe(c.invoiceNumber);
      expect(await documentsOf(ids)).toEqual([]);

      const real = await run.run({ ...base, dryRun: false });
      expect(real.queued).toEqual({ contact: 2, invoice: 3 });
      const docs = await documentsOf(ids);
      expect(docs).toHaveLength(5);
      expect(docs.every((d) => d.product === "shop" && d.target_mode === "dry_run")).toBe(true);
      expect(docs.every((d) => d.state === "pending")).toBe(true);
      expect(
        docs
          .filter((d) => d.kind === "invoice")
          .map((d) => d.number)
          .sort(),
      ).toEqual([a.invoiceNumber, b.invoiceNumber, c.invoiceNumber].sort());
      expect(docs.some((d) => d.kind === "payment")).toBe(false);

      const again = await run.run({ ...base, dryRun: false });
      expect(again.queued).toEqual({ contact: 0, invoice: 0 });
      expect(again.alreadyQueued).toEqual({ contact: 2, invoice: 3 });
      expect(await documentsOf(ids)).toHaveLength(5);
    });

    it("stops at the day's budget across runs and resumes where it stopped", async () => {
      await aim("dry_run");
      const w = window();
      const orders = [
        await seedPaidOrder(owner, w.paidAt(3)),
        await seedPaidOrder(owner, w.paidAt(4)),
        await seedPaidOrder(owner, w.paidAt(5)),
      ];
      const ids = orders.map((o) => o.orderId);
      const run = importer();
      const base = { since: w.since, before: w.before, dryRun: false };

      // Three documents: the first order whole, and the second's contact (a crash-like stop).
      expect((await run.run({ ...base, maxDocuments: 3 })).stoppedAtBudget).toBe(true);
      expect(await documentsOf(ids)).toHaveLength(3);
      // Same day: the budget is spent by the earlier run.
      const spent = await run.run({ ...base, maxDocuments: 3 });
      expect(spent.stoppedAtBudget).toBe(true);
      expect(await documentsOf(ids)).toHaveLength(3);
      // A larger share (or the next day) finishes it, without queuing anything twice.
      const rest = await run.run({ ...base, maxDocuments: 50 });
      expect(rest.stoppedAtBudget).toBe(false);
      expect(rest.queued).toEqual({ contact: 1, invoice: 2 });
      expect(await documentsOf(ids)).toHaveLength(6);
    });

    it("never imports anything for Bid, and refuses a Shop switch not aimed at a Books rehearsal", async () => {
      const w = window();
      const order = await seedPaidOrder(owner, w.paidAt(3));
      const base = { since: w.since, before: w.before, dryRun: false, maxDocuments: 10 };
      await aim("off", "dry_run");
      await expect(importer().run(base)).rejects.toThrow("shop_not_aimed_at_books");
      await aim("live");
      await expect(importer().run(base)).rejects.toThrow("books_live_not_in_rehearsal");
      await aim("dry_run", "dry_run");
      await importer().run(base);
      const bid = await owner.execute(
        sql`select 1 from accounting_document where product = 'bid' and source_event_ref like 'shop_history_import:%'`,
      );
      expect(bid.rows).toHaveLength(0);
      expect((await documentsOf([order.orderId])).every((d) => d.product === "shop")).toBe(true);
    });

    it("backfill: projects a window's Shop events again for the current target, once", async () => {
      const w = window();
      const order = await seedPaidOrder(owner, w.paidAt(3));
      const lines = await owner.execute<{ id: string }>(
        sql`select id from shop_order_line where order_id = ${order.orderId}`,
      );
      await owner.execute(sql`
      insert into domain_events (aggregate_type, aggregate_id, event_type, payload, schema_version, producer, occurred_at)
      values ('shop_order', ${order.orderId}, 'shop.accounting.order_paid',
              ${JSON.stringify({ schemaVersion: 1, orderId: order.orderId, lineIds: lines.rows.map((r) => r.id), paidAt: w.paidAt(3).toISOString() })}::jsonb,
              1, 'shop-api', ${w.paidAt(3).toISOString()}::timestamptz)`);
      await aim("dry_run");
      const repos = createAccountingRepositories(worker, { now: () => new Date() });
      const projection = new AccountingProjection({
        facts: {
          invoiceRaised: vi.fn(),
          paymentCaptured: vi.fn(),
          paymentRefunded: vi.fn(),
        } as never,
        shopFacts: new DrizzleShopAccountingFactsReader(worker),
        settings: repos.settingReader,
        registry: repos.registry,
      });
      const backfill = new BooksBackfill({
        history: new DrizzleBooksHistoryReader(worker),
        projection,
        settings: repos.settingReader,
      });
      const input = { product: "shop" as const, from: w.since, to: w.before, afterId: null };

      const dry = await backfill.run({ ...input, dryRun: true });
      expect(dry).toMatchObject({ events: 1, projected: 0, next: null });
      const count = async () =>
        (
          await owner.execute(
            sql`select 1 from accounting_document
              where lax_reference like ${`%${order.orderId}%`} or lax_reference like ${`%${order.partyId}%`}`,
          )
        ).rows.length;
      expect(await count()).toBe(0);

      const first = await backfill.run({ ...input, dryRun: false });
      expect(first).toMatchObject({ events: 1, projected: 1, created: 3, next: null });
      const second = await backfill.run({ ...input, dryRun: false });
      expect(second).toMatchObject({ projected: 1, created: 0, replayed: 3 });
      expect(await count()).toBe(3);

      // A Bid backfill of the same window reads none of the Shop's events.
      await aim("dry_run", "dry_run");
      expect((await backfill.run({ ...input, product: "bid", dryRun: false })).events).toBe(0);
    });
  },
);
