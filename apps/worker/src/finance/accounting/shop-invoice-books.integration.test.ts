import { randomUUID } from "node:crypto";
import type { DestinationBinding } from "@auction/accounting-domain";
import { createZohoBooksDryRunAdapter } from "@auction/accounting-zoho-books";
import {
  BID_ORG_ID,
  InMemoryAccounting,
  SHOP_ORG_ID,
  testOrgConfigs,
} from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentCopy,
  domainEvent,
  emailOutbox,
} from "@auction/db/schema";
import {
  DrizzleShopAccountingFactsReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingInvoiceCopy } from "./accounting-invoice-copy.service.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);

type BooksMode = "dry_run" | "test_org" | "live";
const PAID_AT = new Date("2031-11-12T14:05:00Z");
const log = { info: vi.fn(), warn: vi.fn() };
/** The Shop's documents go to London Art Exchange's organisation, and only there. */
const bound = (mode: BooksMode, organisationId = SHOP_ORG_ID): DestinationBinding =>
  mode === "dry_run" ? {} : { [mode]: { shop: organisationId } };

const PRINT_PENCE = 45_000;
const FRAME_PENCE = 12_000;

/**
 * A paid Shop order, as the Shop leaves it: a print (a product variant here) framed, the frame's
 * price frozen on its line, delivery as charged, the invoice number from the database's counter
 * (set as paid_at is), and the references-only event. Fixture data only.
 */
async function seedPaidOrder(
  db: Database,
  options: { scope?: "uk" | "outside_uk"; deliveryPence?: number; guest?: boolean } = {},
) {
  const tag = randomUUID().slice(0, 8);
  const subject = options.guest ? null : `shop-books-${tag}`;
  const deliveryPence = options.deliveryPence ?? 2_500;
  const party = await db.execute<{ id: string }>(
    sql`insert into shop_party (display_name, kind) values (${`Buyer ${tag}`}, 'person') returning id`,
  );
  const partyId = party.rows[0]?.id as string;
  const product = await db.execute<{ id: string }>(
    sql`insert into shop_product (slug, title) values (${`print-${tag}`}, ${`Harbour at dusk ${tag}`}) returning id`,
  );
  const variant = await db.execute<{ id: string }>(
    sql`insert into shop_product_variant (product_id, sku, price_pence)
        values (${product.rows[0]?.id}, ${`SKU-${tag}`}, ${PRINT_PENCE}) returning id`,
  );
  const option = await db.execute<{ id: string }>(
    sql`insert into shop_framing_option
          (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days, status, sort_order)
        values (${`books-${tag}`}, 'Natural oak frame', 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 990)
        returning id`,
  );
  let guestId: string | null = null;
  if (options.guest) {
    const guest = await db.execute<{ id: string }>(
      sql`insert into shop_guest_customer (email, name) values (${`guest-${tag}@integration.test`}, ${`Guest ${tag}`}) returning id`,
    );
    guestId = guest.rows[0]?.id as string;
  } else {
    await db.execute(
      sql`insert into shop_user_profile (identity_subject_id, email, name)
          values (${subject}, ${`${subject}@integration.test`}, ${`Ada ${tag}`})`,
    );
  }
  const scope = options.scope ?? "uk";
  const total = PRINT_PENCE + FRAME_PENCE + deliveryPence;
  const order = await db.execute<{ id: string }>(
    sql`insert into shop_order
          (identity_subject_id, guest_customer_id, fulfilment, merchandise_subtotal_pence,
           framing_subtotal_pence, fulfilment_surcharge_pence, fulfilment_vat_pence, total_pence,
           idempotency_key, buyer_party_id)
        values (${subject ?? `guest:${guestId}`}, ${guestId},
                ${scope === "uk" ? "uk_insured_delivery" : "international_quotation"},
                ${PRINT_PENCE}, ${FRAME_PENCE}, ${deliveryPence}, null, ${total},
                ${`books-${tag}`}, ${partyId})
        returning id`,
  );
  const orderId = order.rows[0]?.id as string;
  const print = await db.execute<{ id: string }>(
    sql`insert into shop_order_line (order_id, product_variant_id, unit_price_pence)
        values (${orderId}, ${variant.rows[0]?.id}, ${PRINT_PENCE}) returning id`,
  );
  const printId = print.rows[0]?.id as string;
  const frame = await db.execute<{ id: string }>(
    sql`insert into shop_order_line
          (order_id, kind, framing_for_line_id, framing_option_id, framing_snapshot, unit_price_pence)
        values (${orderId}, 'framing', ${printId}, ${option.rows[0]?.id},
                ${JSON.stringify({ name: "Natural oak frame", pricePence: FRAME_PENCE })}::jsonb, ${FRAME_PENCE})
        returning id`,
  );
  await db.execute(
    sql`update shop_order set status = 'paid', paid_at = ${PAID_AT.toISOString()}::timestamptz where id = ${orderId}`,
  );
  const lineIds = [printId, frame.rows[0]?.id as string].sort();
  await db.insert(domainEvent).values({
    aggregateType: "shop_order",
    aggregateId: orderId,
    eventType: "shop.accounting.order_paid",
    payload: { schemaVersion: 1, orderId, lineIds, paidAt: PAID_AT.toISOString() },
    schemaVersion: 1,
    producer: "shop-api",
  });
  const [event] = await db
    .select()
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.aggregateId, orderId),
        eq(domainEvent.eventType, "shop.accounting.order_paid"),
      ),
    );
  const numbered = await db.execute<{ invoice_number: string }>(
    sql`select invoice_number from shop_order where id = ${orderId}`,
  );
  return {
    tag,
    orderId,
    partyId,
    total,
    event: event as NonNullable<typeof event>,
    invoiceNumber: numbered.rows[0]?.invoice_number as string,
  };
}

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)("Shop invoices to Books (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  const api = createDb(API_URL || (OWNER_URL as string));
  const repos = createAccountingRepositories(worker, { now: () => new Date() });
  const shopFacts = new DrizzleShopAccountingFactsReader(worker);

  afterAll(async () => {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
    await closeDb(owner);
    await closeDb(worker);
    await closeDb(api);
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

  async function aimShop(mode: BooksMode) {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'shop' then ${mode} else 'off' end`);
  }

  const projection = () =>
    new AccountingProjection({
      facts: {
        invoiceRaised: vi.fn(),
        paymentCaptured: vi.fn(),
        paymentRefunded: vi.fn(),
      } as never,
      shopFacts,
      settings: repos.settingReader,
      registry: repos.registry,
    });

  function sender(mode: BooksMode, ports: SenderPorts, destinations = bound(mode)) {
    let n = 0;
    return new AccountingSender({
      workQueue: repos.workQueue,
      dueWork: repos.dueWork,
      transitions: repos.transitions,
      settings: repos.settingReader,
      portsByMode: { [mode]: ports },
      destinations,
      transientErrorPrefixes: [],
      newLeaseToken: () => `lease-${randomUUID()}-${++n}`,
      log,
    });
  }

  async function drain(s: AccountingSender) {
    for (let i = 0; i < 6; i += 1) await s.tick();
  }

  function copier(mode: BooksMode, pdfs: InMemoryAccounting["pdfs"]) {
    const enqueue = vi.fn(async () => ({ outboxId: randomUUID() }));
    const putObject = vi.fn(async () => ({}));
    const service = new AccountingInvoiceCopy({
      copies: repos.copies,
      settings: repos.settingReader,
      pdfsByMode: { [mode]: pdfs },
      storage: { putObject },
      emailFacts: repos.invoiceEmailFacts,
      shopEmailFacts: shopFacts,
      shopStorefrontUrl: "https://shop.example.test",
      email: { enqueue },
      webBaseUrl: "https://lax.bid",
      now: () => new Date(),
      log,
      batch: 1_000,
    });
    return { service, enqueue, putObject };
  }

  /** The order's documents (and its buyer's contact), oldest first. */
  const documentsFor = (seeded: { orderId: string; partyId: string }) =>
    owner
      .select()
      .from(accountingDocument)
      .where(
        or(
          like(accountingDocument.laxReference, `LAX-SHOP-%-${seeded.orderId}%`),
          eq(accountingDocument.laxReference, `LAX-SHOP-CON-${seeded.partyId}`),
        ),
      )
      .orderBy(asc(accountingDocument.createdAt), asc(accountingDocument.laxReference));

  it("reads the order as the worker role: lines as sold, the Shop's number, never the address", async () => {
    const seeded = await seedPaidOrder(owner);
    const read = await shopFacts.orderPaid(seeded.orderId);
    if (read.status !== "ready") throw new Error(read.reason);
    expect(read.facts).toMatchObject({
      orderId: seeded.orderId,
      invoiceNumber: seeded.invoiceNumber,
      paidOn: "2031-11-12",
      totalPence: seeded.total,
      buyer: { partyId: seeded.partyId, email: `shop-books-${seeded.tag}@integration.test` },
      delivery: { scope: "uk", label: "UK insured delivery", grossPence: 2_500, vatPence: null },
    });
    expect(seeded.invoiceNumber).toMatch(/^LAX-INV-\d{6,}$/);
    expect(read.facts.lines.map((l) => [l.kind, l.grossPence])).toEqual(
      expect.arrayContaining([
        ["goods", PRINT_PENCE],
        ["framing", FRAME_PENCE],
      ]),
    );
    expect(read.facts.lines.find((l) => l.kind === "framing")?.label).toBe(
      "Framing: Natural oak frame",
    );
    if (WORKER_URL) {
      const denied = await worker
        .execute(sql`select delivery_line1 from shop_order where id = ${seeded.orderId}`)
        .then(() => null)
        .catch((e: { cause?: { code?: string } }) => e.cause?.code ?? "thrown");
      expect(denied).toBe("42501");
    }
  });

  it("rehearses in dry run: queued in London Art Exchange, sends nothing, emails no one", async () => {
    await aimShop("dry_run");
    const seeded = await seedPaidOrder(owner);
    expect(await projection().project(seeded.event)).toMatchObject({ created: 3, parked: 0 });
    const dryRun = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
    await drain(sender("dry_run", dryRun));
    const docs = await documentsFor(seeded);
    expect(docs.map((d) => [d.kind, d.legalEntity, d.targetMode, d.state])).toEqual([
      ["contact", "london_art_exchange", "dry_run", "issued"],
      ["invoice", "london_art_exchange", "dry_run", "issued"],
      ["payment", "london_art_exchange", "dry_run", "issued"],
    ]);
    const invoice = docs.find((d) => d.kind === "invoice");
    expect(invoice?.providerNumber).toBe("DRY-RUN");
    expect((invoice?.payload as { number?: string }).number).toBe(seeded.invoiceNumber);
    const { service, enqueue } = copier("dry_run", dryRun.pdfs);
    await service.tick();
    const [copy] = await owner
      .select()
      .from(accountingDocumentCopy)
      .where(eq(accountingDocumentCopy.documentId, invoice?.id as string));
    expect(copy?.rehearsal).toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
    const outbox = await owner
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.template, "shop-invoice-issued"));
    expect(outbox.filter((m) => JSON.stringify(m).includes(seeded.orderId))).toEqual([]);
  });

  it("is idempotent by LAX reference, also under six concurrent projections", async () => {
    await aimShop("dry_run");
    const seeded = await seedPaidOrder(owner);
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => projection().project(seeded.event)),
    );
    const created = outcomes.reduce((n, o) => n + (o.outcome === "projected" ? o.created : 0), 0);
    expect(created).toBe(3);
    expect(await documentsFor(seeded)).toHaveLength(3);
    expect(await projection().project(seeded.event)).toMatchObject({ created: 0, replayed: 3 });
  });

  it("parks delivery outside the UK in 'Needs a person': never claimed, never sent, not requeued by staff", async () => {
    await aimShop("dry_run");
    const seeded = await seedPaidOrder(owner, { scope: "outside_uk", deliveryPence: 8_500 });
    expect(await projection().project(seeded.event)).toMatchObject({ created: 4, parked: 1 });
    const dryRun = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
    await drain(sender("dry_run", dryRun));
    const docs = await documentsFor(seeded);
    const parked = docs.find((d) => d.laxReference === `LAX-SHOP-INV-${seeded.orderId}-delivery`);
    expect(parked).toMatchObject({
      state: "needs_review",
      needsReviewReason: "accounting_parked_vat_on_outside_uk_delivery",
      attempts: 0,
      provider: null,
      grossPence: 8_500,
      vatPence: 0,
    });
    const invoice = docs.find((d) => d.laxReference === `LAX-SHOP-INV-${seeded.orderId}`);
    expect(invoice?.grossPence).toBe(PRINT_PENCE + FRAME_PENCE);
    const payment = docs.find((d) => d.kind === "payment");
    expect(payment?.grossPence ?? (payment?.payload as { amountPence: number }).amountPence).toBe(
      seeded.total,
    );
    expect(
      docs
        .filter((d) => d.state === "issued")
        .map((d) => d.kind)
        .sort(),
    ).toEqual(["contact", "invoice", "payment"]);
    if (API_URL) {
      const refused = await api
        .execute(sql`update accounting_document set state = 'pending', review_lookup = null,
                          needs_review_reason = null where id = ${parked?.id}`)
        .then(() => null)
        .catch((e: { cause?: { code?: string } }) => e.cause?.code ?? "thrown");
      expect(refused).toBe("42501");
    }
  });

  it("holds a totals mismatch for a person and keeps Books' figure (no copy, no email)", async () => {
    await aimShop("live");
    const seeded = await seedPaidOrder(owner);
    await projection().project(seeded.event);
    const books = new InMemoryAccounting({
      orgs: { london_art_exchange: { vatRegistered: false } },
    });
    // The contact takes the first (a contact has no totals); the invoice comes back 1p out.
    books.faults.inject("totals_drift");
    books.faults.inject("totals_drift");
    await drain(sender("live", books));
    const invoice = (await documentsFor(seeded)).find((d) => d.kind === "invoice");
    expect(invoice).toMatchObject({
      state: "needs_review",
      mismatchField: "vatPence",
      mismatchDifferencePence: 1,
    });
    const { service, enqueue } = copier("live", books.pdfs);
    await service.tick();
    expect(
      await owner
        .select()
        .from(accountingDocumentCopy)
        .where(eq(accountingDocumentCopy.documentId, invoice?.id as string)),
    ).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("issues live under the Shop's own number and emails the order's owner once", async () => {
    await aimShop("live");
    const seeded = await seedPaidOrder(owner);
    await projection().project(seeded.event);
    const books = new InMemoryAccounting({
      orgs: { london_art_exchange: { vatRegistered: false } },
    });
    await drain(sender("live", books));
    const invoice = (await documentsFor(seeded)).find((d) => d.kind === "invoice");
    expect(invoice).toMatchObject({ state: "issued", providerNumber: seeded.invoiceNumber });
    const { service, enqueue } = copier("live", books.pdfs);
    expect(await service.tick()).toMatchObject({ stored: expect.any(Number), emailed: 1 });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "shop-invoice-issued",
        to: `shop-books-${seeded.tag}@integration.test`,
        idempotencyKey: `shop-invoice-issued:${invoice?.id}`,
      }),
    );
    expect(await service.tick()).toEqual({ stored: 0, emailed: 0 });
  });

  it("emails the account that claimed a guest's order, never the guest it was", async () => {
    await aimShop("live");
    const seeded = await seedPaidOrder(owner, { guest: true });
    const account = `shop-books-claimed-${seeded.tag}`;
    await owner.execute(sql`insert into shop_user_profile (identity_subject_id, email, name)
                            values (${account}, ${`${account}@integration.test`}, 'Claimed')`);
    await owner.execute(
      sql`update shop_order set identity_subject_id = ${account} where id = ${seeded.orderId}`,
    );
    await projection().project(seeded.event);
    const books = new InMemoryAccounting({
      orgs: { london_art_exchange: { vatRegistered: false } },
    });
    await drain(sender("live", books));
    const { service, enqueue } = copier("live", books.pdfs);
    await service.tick();
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: `${account}@integration.test` }),
    );
  });

  it("emails no one at the test organisation (rehearsal for anything buyer-facing)", async () => {
    await aimShop("test_org");
    const seeded = await seedPaidOrder(owner);
    await projection().project(seeded.event);
    const books = new InMemoryAccounting({
      orgs: { london_art_exchange: { vatRegistered: false } },
    });
    await drain(sender("test_org", books));
    const { service, enqueue } = copier("test_org", books.pdfs);
    expect(await service.tick()).toMatchObject({ emailed: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("lists no test organisation copy as due even while another product is live", async () => {
    // Bid live keeps the email step running; the Shop's test_org copy must still never be due.
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off',
             books_mode = case product when 'shop' then 'test_org' when 'bid' then 'live' else 'off' end`);
    const seeded = await seedPaidOrder(owner);
    await projection().project(seeded.event);
    const books = new InMemoryAccounting({
      orgs: { london_art_exchange: { vatRegistered: false } },
    });
    await drain(sender("test_org", books));
    const { service } = copier("test_org", books.pdfs);
    await service.tick();
    const due = await repos.copies.listEmailDue(1_000);
    const invoice = (await documentsFor(seeded)).find((d) => d.kind === "invoice");
    expect(due.due.map((d) => d.documentId)).not.toContain(invoice?.id);
  });

  it("never sends a Shop document to the Bid organisation (entity binding)", async () => {
    await aimShop("live");
    const seeded = await seedPaidOrder(owner);
    await projection().project(seeded.event);
    const books = new InMemoryAccounting({
      orgs: { london_art_exchange: { vatRegistered: false } },
    });
    await drain(sender("live", books, bound("live", BID_ORG_ID)));
    const docs = await documentsFor(seeded);
    expect(docs.some((d) => d.state === "issued")).toBe(false);
    expect(docs.every((d) => d.provider === null || d.state !== "issued")).toBe(true);
  });
});
