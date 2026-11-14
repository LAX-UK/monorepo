import { randomUUID } from "node:crypto";
import type { DestinationBinding } from "@auction/accounting-domain";
import { createZohoBooksDryRunAdapter } from "@auction/accounting-zoho-books";
import {
  InMemoryAccounting,
  SHOP_ORG_ID,
  testOrgConfigs,
} from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import { accountingDocument, domainEvent } from "@auction/db/schema";
import {
  DrizzleShopAccountingFactsReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { beforeAll } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingInvoiceCopy } from "./accounting-invoice-copy.service.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);

type BooksMode = "dry_run" | "test_org" | "live";
const PAID_AT = new Date("2031-11-14T11:30:00Z");
const PRICE = 1_250_000;
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const bound = (mode: BooksMode): DestinationBinding =>
  mode === "dry_run" ? {} : { [mode]: { shop: SHOP_ORG_ID } };

/**
 * An original sold directly in the Shop and paid, as the Shop leaves it: the buyer's account, the
 * sale with its issuer, paid_at set (the database numbers a Books sale from the Shop's counter) and
 * the references-only event. Fixture data only.
 */
async function seedPaidOriginal(
  db: Database,
  issuer: "books" | "stripe" = "books",
  options: {
    /** False: a buyer party created for the sale, with no LAX account. */
    account?: boolean;
    /** Whom staff confirmed the invoice goes to when they issued it. */
    recipient?: { email: string; name: string | null };
  } = {},
) {
  const tag = randomUUID().slice(0, 8);
  const subject = `shop-original-${tag}`;
  const account = options.account ?? true;
  if (account) {
    await db.execute(
      sql`insert into shop_user_profile (identity_subject_id, email, name)
          values (${subject}, ${`${subject}@integration.test`}, ${`Ada ${tag}`})`,
    );
  }
  const parties = await db.execute<{ id: string }>(
    sql`insert into shop_party (display_name, identity_subject_id)
        values (${`Buyer ${tag}`}, ${account ? subject : null})
        returning id`,
  );
  const partyId = parties.rows[0]?.id as string;
  const artistParty = await db.execute<{ id: string }>(
    sql`insert into shop_party (display_name) values (${`Artist ${tag}`}) returning id`,
  );
  const artist = await db.execute<{ id: string }>(
    sql`insert into shop_artist (party_id, slug) values (${artistParty.rows[0]?.id}, ${`artist-${tag}`})
        returning id`,
  );
  const artwork = await db.execute<{ id: string }>(
    sql`insert into shop_artwork (artist_id, title, slug, eligible_for_edition_allocation, import_key)
        values (${artist.rows[0]?.id}, ${`Harbour at dusk ${tag}`}, ${`original-${tag}`}, false, ${`original-${tag}`})
        returning id`,
  );
  const sale = await db.execute<{ id: string }>(
    sql`insert into shop_original_sale
          (artwork_id, buyer_party_id, sale_price_pence, recorded_by_subject_id, status, invoice_issuer)
        values (${artwork.rows[0]?.id}, ${partyId}, ${PRICE}, 'staff:integration', 'invoiced', ${issuer})
        returning id`,
  );
  const saleId = sale.rows[0]?.id as string;
  if (options.recipient) {
    await db.execute(
      sql`update shop_original_sale
             set invoice_recipient_email = ${options.recipient.email},
                 invoice_recipient_name = ${options.recipient.name}
           where id = ${saleId}`,
    );
  }
  await db.execute(
    sql`update shop_original_sale set status = 'paid', paid_at = ${PAID_AT.toISOString()}::timestamptz
        where id = ${saleId}`,
  );
  await db.insert(domainEvent).values({
    aggregateType: "shop_original_sale",
    aggregateId: saleId,
    eventType: "shop.accounting.original_sale_paid",
    payload: { schemaVersion: 1, originalSaleId: saleId, paidAt: PAID_AT.toISOString() },
    schemaVersion: 1,
    producer: "shop-api",
  });
  const [event] = await db
    .select()
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.aggregateId, saleId),
        eq(domainEvent.eventType, "shop.accounting.original_sale_paid"),
      ),
    );
  const numbered = await db.execute<{ invoice_number: string | null }>(
    sql`select invoice_number from shop_original_sale where id = ${saleId}`,
  );
  return {
    tag,
    saleId,
    partyId,
    subject,
    event: event as NonNullable<typeof event>,
    invoiceNumber: numbered.rows[0]?.invoice_number ?? null,
  };
}

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)(
  "Shop originals invoiced in Books (integration)",
  { timeout: 60_000 },
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const owner = createDb(OWNER_URL!);
    const worker = createDb(WORKER_URL || (OWNER_URL as string));
    const repos = createAccountingRepositories(worker, { now: () => new Date() });
    const shopFacts = new DrizzleShopAccountingFactsReader(worker);

    afterAll(async () => {
      await owner.execute(sql`
        update accounting_source_setting
           set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
      await closeDb(owner);
      await closeDb(worker);
    });

    beforeEach(async () => {
      await owner.execute(sql`
        update accounting_document
           set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
         where state in ('pending', 'sending', 'failed', 'unknown')`);
      await owner.execute(sql`
        update accounting_document_copy
           set email_skipped_at = now(), email_skip_reason = 'invoice_missing'
         where email_queued_at is null and email_skipped_at is null and not rehearsal`);
    });

    async function aimShop(mode: BooksMode | "off") {
      await owner.execute(sql`
        update accounting_source_setting
           set xero_mode = 'off', books_mode = case product when 'shop' then ${mode} else 'off' end`);
    }

    const projection = () =>
      new AccountingProjection({
        facts: {} as never,
        shopFacts,
        settings: repos.settingReader,
        registry: repos.registry,
      });

    async function drain(mode: BooksMode, ports: SenderPorts) {
      let n = 0;
      const sender = new AccountingSender({
        workQueue: repos.workQueue,
        dueWork: repos.dueWork,
        transitions: repos.transitions,
        settings: repos.settingReader,
        portsByMode: { [mode]: ports },
        destinations: bound(mode),
        transientErrorPrefixes: [],
        newLeaseToken: () => `lease-${randomUUID()}-${++n}`,
        log,
      });
      for (let i = 0; i < 6; i += 1) await sender.tick();
    }

    function copier(mode: BooksMode, pdfs: InMemoryAccounting["pdfs"]) {
      const enqueue = vi.fn(async () => ({ outboxId: randomUUID() }));
      const service = new AccountingInvoiceCopy({
        copies: repos.copies,
        settings: repos.settingReader,
        pdfsByMode: { [mode]: pdfs },
        storage: { putObject: vi.fn(async () => ({})) },
        emailFacts: repos.invoiceEmailFacts,
        shopEmailFacts: shopFacts,
        shopStorefrontUrl: "https://shop.example.test",
        email: { enqueue },
        webBaseUrl: "https://lax.bid",
        now: () => new Date(),
        log,
        batch: 1_000,
      });
      return { service, enqueue };
    }

    const documentsFor = (seeded: { saleId: string; partyId: string }) =>
      owner
        .select()
        .from(accountingDocument)
        .where(
          or(
            eq(accountingDocument.laxReference, `LAX-SHOP-INV-original-${seeded.saleId}`),
            eq(accountingDocument.laxReference, `LAX-SHOP-PAY-original-${seeded.saleId}`),
            eq(accountingDocument.laxReference, `LAX-SHOP-CON-${seeded.partyId}`),
          ),
        )
        .orderBy(asc(accountingDocument.createdAt), asc(accountingDocument.laxReference));

    it("reads the sale as the worker role, under the number the Shop's counter gave it", async () => {
      const seeded = await seedPaidOriginal(owner);
      expect(seeded.invoiceNumber).toMatch(/^LAX-INV-\d{6,}$/);
      const read = await shopFacts.originalSalePaid(seeded.saleId);
      if (read.status !== "ready") throw new Error(read.reason);
      expect(read.facts).toEqual({
        originalSaleId: seeded.saleId,
        invoiceNumber: seeded.invoiceNumber,
        buyer: {
          partyId: seeded.partyId,
          name: `Ada ${seeded.tag}`,
          email: `${seeded.subject}@integration.test`,
        },
        paidOn: "2031-11-14",
        label: `Original artwork: Harbour at dusk ${seeded.tag}`,
        salePricePence: PRICE,
        vatTreatment: null,
        vatPence: null,
      });
      if (WORKER_URL) {
        const denied = await worker
          .execute(
            sql`select stripe_payment_link_id from shop_original_sale where id = ${seeded.saleId}`,
          )
          .then(() => null)
          .catch((e: { cause?: { code?: string } }) => e.cause?.code ?? "thrown");
        expect(denied).toBe("42501");
      }
    });

    it("rehearses in dry run: London Art Exchange, the Shop's number, sends nothing, emails no one", async () => {
      await aimShop("dry_run");
      const seeded = await seedPaidOriginal(owner);
      expect(await projection().project(seeded.event)).toMatchObject({ created: 3, parked: 0 });
      const dryRun = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
      await drain("dry_run", dryRun);
      const docs = await documentsFor(seeded);
      expect(docs.map((d) => [d.kind, d.legalEntity, d.targetMode, d.state])).toEqual([
        ["contact", "london_art_exchange", "dry_run", "issued"],
        ["invoice", "london_art_exchange", "dry_run", "issued"],
        ["payment", "london_art_exchange", "dry_run", "issued"],
      ]);
      const invoice = docs.find((d) => d.kind === "invoice");
      expect((invoice?.payload as { number?: string }).number).toBe(seeded.invoiceNumber);
      expect(invoice?.grossPence).toBe(PRICE);
      const { service, enqueue } = copier("dry_run", dryRun.pdfs);
      await service.tick();
      expect(enqueue).not.toHaveBeenCalled();
      // Replayed by LAX reference: never a second invoice.
      expect(await projection().project(seeded.event)).toMatchObject({ created: 0, replayed: 3 });
    });

    it("issues under the Shop's own number and emails the buyer once, naming the original", async () => {
      await aimShop("live");
      const seeded = await seedPaidOriginal(owner);
      await projection().project(seeded.event);
      const books = new InMemoryAccounting({
        orgs: { london_art_exchange: { vatRegistered: false } },
      });
      await drain("live", books);
      const invoice = (await documentsFor(seeded)).find((d) => d.kind === "invoice");
      expect(invoice).toMatchObject({ state: "issued", providerNumber: seeded.invoiceNumber });
      const { service, enqueue } = copier("live", books.pdfs);
      expect(await service.tick()).toMatchObject({ emailed: 1 });
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "shop-invoice-issued",
          to: `${seeded.subject}@integration.test`,
          idempotencyKey: `shop-invoice-issued:${invoice?.id}`,
          vars: expect.objectContaining({
            invoiceNumber: seeded.invoiceNumber,
            total: "£12,500.00",
            originalTitle: `Harbour at dusk ${seeded.tag}`,
            orderUrl: "https://shop.example.test/account",
          }),
        }),
      );
      expect(await service.tick()).toEqual({ stored: 0, emailed: 0 });
    });

    it("books nothing for a sale Stripe invoiced, which takes no LAX number", async () => {
      await aimShop("dry_run");
      const seeded = await seedPaidOriginal(owner, "stripe");
      expect(seeded.invoiceNumber).toBeNull();
      expect(await projection().project(seeded.event)).toEqual({
        outcome: "skipped",
        reason: "original_sale_invoiced_by_stripe",
      });
      expect(await documentsFor(seeded)).toEqual([]);
    });

    it("invoices and emails whom staff confirmed, even a buyer with no LAX account", async () => {
      await aimShop("live");
      const recipient = { email: "collector@example.test", name: "Grace Collector" };
      const seeded = await seedPaidOriginal(owner, "books", { account: false, recipient });
      const read = await shopFacts.originalSalePaid(seeded.saleId);
      if (read.status !== "ready") throw new Error(read.reason);
      expect(read.facts.buyer).toEqual({
        partyId: seeded.partyId,
        name: "Grace Collector",
        email: "collector@example.test",
      });
      await projection().project(seeded.event);
      const books = new InMemoryAccounting({
        orgs: { london_art_exchange: { vatRegistered: false } },
      });
      await drain("live", books);
      const { service, enqueue } = copier("live", books.pdfs);
      expect(await service.tick()).toMatchObject({ emailed: 1 });
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ to: "collector@example.test" }),
      );
    });

    it("raises an error for a person when an original's invoice has nobody to go to", async () => {
      await aimShop("live");
      const seeded = await seedPaidOriginal(owner, "books", { account: false });
      await projection().project(seeded.event);
      const books = new InMemoryAccounting({
        orgs: { london_art_exchange: { vatRegistered: false } },
      });
      await drain("live", books);
      log.error.mockClear();
      const { service, enqueue } = copier("live", books.pdfs);
      expect(await service.tick()).toMatchObject({ emailed: 0 });
      expect(enqueue).not.toHaveBeenCalled();
      expect(log.error).toHaveBeenCalledWith(
        expect.objectContaining({ originalSaleId: seeded.saleId }),
        "accounting_original_invoice_unsent",
      );
    });

    it("prefers the address staff confirmed over the buyer's LAX account", async () => {
      const seeded = await seedPaidOriginal(owner, "books", {
        recipient: { email: "elsewhere@example.test", name: null },
      });
      const read = await shopFacts.originalSalePaid(seeded.saleId);
      if (read.status !== "ready") throw new Error(read.reason);
      // With no name confirmed, the contact takes the buyer party's own name.
      expect(read.facts.buyer).toMatchObject({
        email: "elsewhere@example.test",
        name: `Buyer ${seeded.tag}`,
      });
      expect((await shopFacts.forOriginalSale(seeded.saleId))?.recipient).toEqual({
        email: "elsewhere@example.test",
        name: null,
      });
    });

    it("attributes an original's Stripe charge to the Shop, by function, as the worker role", async () => {
      const seeded = await seedPaidOriginal(owner);
      const pi = `pi_original_${seeded.tag}`;
      await owner.execute(
        sql`update shop_original_sale set stripe_payment_intent_id = ${pi} where id = ${seeded.saleId}`,
      );
      expect(
        await repos.stripeLedger.productsForCharge({ paymentIntentId: pi, chargeId: null }),
      ).toEqual(["shop"]);
      expect(
        await repos.stripeLedger.productsForCharge({
          paymentIntentId: `${pi}_none`,
          chargeId: null,
        }),
      ).toEqual([]);
    });

    it("never sends a Books sale with no LAX number to the books, so Books never numbers it", async () => {
      await aimShop("dry_run");
      const seeded = await seedPaidOriginal(owner);
      await owner.execute(
        sql`update shop_original_sale set invoice_number = null where id = ${seeded.saleId}`,
      );
      expect(await projection().project(seeded.event)).toEqual({
        outcome: "skipped",
        reason: "original_sale_not_invoiced",
      });
      expect((await documentsFor(seeded)).filter((d) => d.kind !== "contact")).toEqual([]);
    });
  },
);
