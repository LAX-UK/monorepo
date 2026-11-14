import { randomUUID } from "node:crypto";
import type { DestinationBinding, LineBooking } from "@auction/accounting-domain";
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
  accountingDocumentEvent,
  domainEvent,
  emailOutbox,
} from "@auction/db/schema";
import { AccountingQueueService } from "@auction/finance-runtime";
import {
  DrizzleBidAccountingFactsReader,
  DrizzleShopAccountingFactsReader,
  DrizzleShopDeliveryReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingInvoiceCopy } from "./accounting-invoice-copy.service.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingRemainder } from "./accounting-remainder.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);

type BooksMode = "dry_run" | "test_org" | "live";
const PAID_AT = new Date("2031-11-12T14:05:00Z");
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
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
/**
 * The one framing option every seeded order's frame names. Found or made once under a fixed code,
 * with a price for every size band as a real option has (the framing catalogue lists every
 * option and needs them), so the shared test database gains a single draft option however often
 * this file runs: a framing line as sold is never deleted, so per-run options could never go.
 */
const FRAMING_FIXTURE_CODE = "books-integration-fixture";
const FRAMING_BANDS = ["up_to_40x50", "up_to_60x80", "up_to_80x100"] as const;
async function framingOption(db: Database): Promise<string> {
  await db.execute(
    sql`insert into shop_framing_option
          (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days, status, sort_order)
        values (${FRAMING_FIXTURE_CODE}, 'Natural oak frame', 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 990)
        on conflict (code) do nothing`,
  );
  const found = await db.execute<{ id: string }>(
    sql`select id from shop_framing_option where code = ${FRAMING_FIXTURE_CODE}`,
  );
  const id = found.rows[0]?.id as string;
  for (const band of FRAMING_BANDS) {
    await db.execute(
      sql`insert into shop_framing_option_price (option_id, band, price_pence, is_placeholder)
          values (${id}, ${band}, ${FRAME_PENCE}, false)
          on conflict (option_id, band) do nothing`,
    );
  }
  return id;
}

type SeedOptions = { scope?: "uk" | "outside_uk"; deliveryPence?: number; guest?: boolean };

/** An order as the Shop leaves it before payment: no number, no event. */
async function seedOrder(db: Database, options: SeedOptions = {}) {
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
  const optionId = await framingOption(db);
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
        values (${orderId}, 'framing', ${printId}, ${optionId},
                ${JSON.stringify({ name: "Natural oak frame", pricePence: FRAME_PENCE })}::jsonb, ${FRAME_PENCE})
        returning id`,
  );
  const lineIds = [printId, frame.rows[0]?.id as string].sort();
  return { tag, orderId, partyId, total, lineIds, subject, guestId };
}

/** The order paid, as the Shop pays it: the number from the counter and the references-only event. */
async function seedPaidOrder(db: Database, options: SeedOptions = {}) {
  const { tag, orderId, partyId, total, lineIds, subject, guestId } = await seedOrder(db, options);
  await db.execute(
    sql`update shop_order set status = 'paid', paid_at = ${PAID_AT.toISOString()}::timestamptz where id = ${orderId}`,
  );
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
    subject,
    guestId,
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

  function copier(
    mode: BooksMode,
    pdfs: InMemoryAccounting["pdfs"],
    options: { readonly url?: string | undefined; readonly batch?: number } = {},
  ) {
    const enqueue = vi.fn(async () => ({ outboxId: randomUUID() }));
    const putObject = vi.fn(async () => ({}));
    const service = new AccountingInvoiceCopy({
      copies: repos.copies,
      settings: repos.settingReader,
      pdfsByMode: { [mode]: pdfs },
      storage: { putObject },
      emailFacts: repos.invoiceEmailFacts,
      shopEmailFacts: shopFacts,
      shopStorefrontUrl: "url" in options ? options.url : "https://shop.example.test",
      email: { enqueue },
      webBaseUrl: "https://lax.bid",
      now: () => new Date(),
      log,
      batch: options.batch ?? 1_000,
    });
    return { service, enqueue, putObject };
  }

  /** Finance › Accounting as the Bid API runs it (api_app): Try again and Release. */
  function releaser(shopOutsideUkBooking?: LineBooking | null) {
    const apiRepos = createAccountingRepositories(api, { now: () => new Date() });
    const audits: unknown[] = [];
    const service = new AccountingQueueService({
      browser: apiRepos.browser,
      partFunded: apiRepos.partFunded,
      transitions: apiRepos.transitions,
      audit: {
        retryRequested: async (input) => void audits.push(input),
        releaseRequested: async (input) => void audits.push(input),
      },
      booksLink: () => null,
      facts: new DrizzleBidAccountingFactsReader(api),
      lookup: apiRepos.lookup,
      shopDelivery: new DrizzleShopDeliveryReader(api),
      ...(shopOutsideUkBooking === undefined ? {} : { shopOutsideUkBooking }),
    });
    return { service, audits };
  }

  function remainder(mode: BooksMode, ports: InMemoryAccounting["remainders"]) {
    return new AccountingRemainder({
      remainders: repos.remainders,
      settings: repos.settingReader,
      portsByMode: { [mode]: ports },
      log,
    });
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
    // Staff cannot try it again, and Release is refused while the accountant has not answered:
    // the stored order still parks it. Nothing changes and nothing is recorded.
    const { service, audits } = releaser();
    expect(
      await service.tryAgain({ documentId: parked?.id as string, actorUserId: "staff-1" }),
    ).toMatchObject({ ok: false, refusal: "not_allowed" });
    expect(
      await service.release({ documentId: parked?.id as string, actorUserId: "staff-1" }),
    ).toMatchObject({ ok: false, refusal: "unresolved" });
    expect(audits).toEqual([]);
    const [still] = await owner
      .select()
      .from(accountingDocument)
      .where(eq(accountingDocument.id, parked?.id as string));
    expect(still).toMatchObject({ state: "needs_review", payload: parked?.payload });
    if (API_URL) {
      // The table holds the shape whatever the application does: api_app may not queue it with
      // another amount, nor rebuild anything but a delivery invoice under its own reference.
      const refused = await api
        .execute(sql`update accounting_document set state = 'pending', review_lookup = null,
                          needs_review_reason = null, gross_pence = gross_pence + 1
                      where id = ${parked?.id}`)
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

  it("RC-B: with SHOP_STOREFRONT_URL unset, waiting Shop invoice emails never hold a Bid invoice email back", async () => {
    await aimShop("live");
    const books = new InMemoryAccounting({
      orgs: { london_art_exchange: { vatRegistered: false } },
    });
    const shopInvoices: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const seeded = await seedPaidOrder(owner);
      await projection().project(seeded.event);
      await drain(sender("live", books));
      const invoice = (await documentsFor(seeded)).find((d) => d.kind === "invoice");
      shopInvoices.push(invoice?.id as string);
    }
    const refused = copier("live", books.pdfs, { url: undefined, batch: 3 });
    // Three live Shop copies stored first, each left due (no address to link to).
    await refused.service.tick();
    // Then one Bid invoice copy, stored after them (fixture row: no Bid invoice behind it).
    const bidId = randomUUID();
    const [bid] = await owner
      .insert(accountingDocument)
      .values({
        product: "bid",
        legalEntity: "london_auction_xchange",
        kind: "invoice",
        laxReference: `LAX-BID-INV-${bidId}`,
        sourceEventRef: `rc-b-${bidId}`,
        payload: {},
        netPence: 100,
        vatPence: 0,
        grossPence: 100,
        state: "issued",
        provider: "books",
        targetProvider: "books",
        targetMode: "live",
        providerId: `rc-b-${bidId}`,
        providerNumber: `RC-B-${bidId.slice(0, 8)}`,
      })
      .returning({ id: accountingDocument.id });
    await owner.insert(accountingDocumentCopy).values({
      documentId: bid?.id as string,
      storageKey: `accounting/london_auction_xchange/${bid?.id}.pdf`,
      byteSize: 1,
      sha256: "0".repeat(64),
      rehearsal: false,
      storedAt: new Date(Date.now() + 60_000),
    });
    for (let i = 0; i < 5; i += 1) await refused.service.tick();

    const copies = await owner
      .select()
      .from(accountingDocumentCopy)
      .where(
        or(
          ...[...shopInvoices, bid?.id as string].map((id) =>
            eq(accountingDocumentCopy.documentId, id),
          ),
        ),
      );
    const bidCopy = copies.find((c) => c.documentId === bid?.id);
    // The Bid copy was reached (here skipped: no Bid invoice behind the fixture row).
    expect(bidCopy?.emailSkippedAt ?? bidCopy?.emailQueuedAt).not.toBeNull();
    // Every Shop copy is still due: never settled, never emailed.
    for (const id of shopInvoices) {
      const shopCopy = copies.find((c) => c.documentId === id);
      expect(shopCopy).toMatchObject({ emailQueuedAt: null, emailSkippedAt: null });
    }
    expect(refused.enqueue).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ product: "shop" }),
      "accounting_shop_invoice_email_refused",
    );
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

  describe("ordering: an invoice after its contact, a payment after its contact and invoice", () => {
    const books = () =>
      new InMemoryAccounting({ orgs: { london_art_exchange: { vatRegistered: false } } });

    it("R1: six concurrent senders over four rounds issue all three, every run", async () => {
      await aimShop("live");
      for (let run = 0; run < 5; run += 1) {
        const seeded = await seedPaidOrder(owner);
        await projection().project(seeded.event);
        const held = books();
        const senders = Array.from({ length: 6 }, () => sender("live", held));
        for (let round = 0; round < 4; round += 1) {
          await Promise.all(senders.map((s) => s.tick()));
        }
        const docs = await documentsFor(seeded);
        expect(docs.map((d) => [d.kind, d.state, d.needsReviewReason ?? null])).toEqual([
          ["contact", "issued", null],
          ["invoice", "issued", null],
          ["payment", "issued", null],
        ]);
        expect(docs.every((d) => d.attempts === 1)).toBe(true);
      }
    });

    it("R2: one sender, the three registered in the same millisecond, issues all three, every run", async () => {
      await aimShop("live");
      for (let run = 0; run < 5; run += 1) {
        const seeded = await seedPaidOrder(owner);
        await projection().project(seeded.event);
        const docs = await documentsFor(seeded);
        // One projection, one clock tick: only the uuid would order them.
        await owner.execute(sql`update accounting_document set created_at = ${new Date().toISOString()}::timestamptz
                                 where id in (${sql.join(
                                   docs.map((d) => sql`${d.id}`),
                                   sql`, `,
                                 )})`);
        const one = sender("live", books());
        for (let i = 0; i < 4; i += 1) await one.tick();
        const after = await documentsFor(seeded);
        expect(after.map((d) => [d.kind, d.state]).sort()).toEqual([
          ["contact", "issued"],
          ["invoice", "issued"],
          ["payment", "issued"],
        ]);
        expect(after.every((d) => d.attempts === 1)).toBe(true);
      }
    });

    it("R3: eight orders paid in concurrent transactions get distinct LAX-INV- numbers, no gaps", async () => {
      const unpaid = await Promise.all(Array.from({ length: 8 }, () => seedOrder(owner)));
      const paid = await Promise.all(
        unpaid.map(({ orderId }) =>
          owner
            .execute<{ invoice_number: string }>(
              sql`update shop_order set status = 'paid', paid_at = now()
                   where id = ${orderId} returning invoice_number`,
            )
            .then((r) => r.rows[0]?.invoice_number as string),
        ),
      );
      const numbers = paid
        .map((n) => Number(/^LAX-INV-(\d{6,})$/.exec(n)?.[1]))
        .sort((a, b) => a - b);
      expect(new Set(numbers).size).toBe(8);
      expect(numbers.every((n, i) => i === 0 || n === (numbers[i - 1] as number) + 1)).toBe(true);
    });
  });

  describe("recovery of a parked outside-UK delivery once the accountant answers", () => {
    /** An answer the accountant might give that keeps what was charged (the test stands in for it). */
    const ZERO: LineBooking = { role: "delivery", treatment: "zero" };

    it("Release, send, then the payment's rest applied to the delivery invoice once (end to end)", async () => {
      await aimShop("live");
      const seeded = await seedPaidOrder(owner, { scope: "outside_uk", deliveryPence: 8_500 });
      expect(await projection().project(seeded.event)).toMatchObject({ created: 4, parked: 1 });
      const held = new InMemoryAccounting({
        orgs: { london_art_exchange: { vatRegistered: false } },
      });
      await drain(sender("live", held));
      const reference = `LAX-SHOP-INV-${seeded.orderId}-delivery`;
      const paymentReference = `LAX-SHOP-PAY-${seeded.orderId}`;
      const parked = (await documentsFor(seeded)).find((d) => d.laxReference === reference);
      const ask = { documentId: parked?.id as string, actorUserId: "staff-1" };

      // 1. Before the answer: refused, with the booking in force (none is set).
      expect(await releaser().service.release(ask)).toMatchObject({
        ok: false,
        refusal: "unresolved",
      });
      // Nothing to apply yet: the delivery invoice is not issued.
      expect(await remainder("live", held.remainders).tick()).toEqual({ applied: 0, refused: 0 });

      // 2. The answer is deployed (here, given to the service): Release rebuilds and queues it.
      const { service, audits } = releaser(ZERO);
      expect(await service.release(ask)).toEqual({
        ok: true,
        value: { id: parked?.id, reference, outcome: "released", rebuilt: true },
      });
      expect(audits).toEqual([
        expect.objectContaining({
          actorUserId: "staff-1",
          payload: expect.objectContaining({ parked: "vat_on_outside_uk_delivery", rebuilt: true }),
        }),
      ]);
      const history = await owner
        .select()
        .from(accountingDocumentEvent)
        .where(eq(accountingDocumentEvent.documentId, parked?.id as string))
        .orderBy(asc(accountingDocumentEvent.id));
      expect(history.map((e) => [e.action, e.fromState, e.toState])).toContainEqual([
        "release",
        "needs_review",
        "pending",
      ]);
      // A second Release changes nothing more.
      expect(await service.release(ask)).toMatchObject({
        ok: true,
        value: { outcome: "already_queued" },
      });

      // 3. The sender issues it, rebuilt with the booking, under the same reference and gross.
      await drain(sender("live", held));
      const issued = (await documentsFor(seeded)).find((d) => d.laxReference === reference);
      expect(issued).toMatchObject({ state: "issued", grossPence: 8_500, vatPence: 0 });
      expect((issued?.payload as { lines: { treatment: string }[] }).lines[0]?.treatment).toBe(
        "zero",
      );

      // 4. The follow-up: the payment's unapplied rest is applied to it, once.
      const step = remainder("live", held.remainders);
      expect(await step.tick()).toEqual({ applied: 1, refused: 0 });
      expect([...held.remainderAppliedOf("shop", paymentReference).values()]).toEqual([8_500]);
      expect(await step.tick()).toEqual({ applied: 0, refused: 0 });
      const settled = await owner
        .select()
        .from(accountingDocumentEvent)
        .where(
          and(
            eq(accountingDocumentEvent.documentId, issued?.id as string),
            eq(accountingDocumentEvent.action, "apply_remainder"),
          ),
        );
      expect(settled).toHaveLength(1);
      expect(settled[0]).toMatchObject({
        fromState: "issued",
        toState: "issued",
        detail: { outcome: "applied", paymentReference, amountPence: 8_500, rehearsal: false },
      });

      // A run whose record was lost asks Books again and is told it is already applied.
      expect(
        await held.remainders.applyRemainder({
          product: "shop",
          entity: "london_art_exchange",
          paymentReference,
          invoiceReference: reference,
          contactReference: `LAX-SHOP-CON-${seeded.partyId}`,
          amountPence: 8_500,
        }),
      ).toEqual({ status: "already_applied", rehearsal: false });

      // The delivery invoice is not emailed as the order's; the order's own invoice is.
      const { service: copy, enqueue } = copier("live", held.pdfs);
      await copy.tick();
      const [deliveryCopy] = await owner
        .select()
        .from(accountingDocumentCopy)
        .where(eq(accountingDocumentCopy.documentId, issued?.id as string));
      expect(deliveryCopy?.emailSkipReason).toBe("not_order_invoice");
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          // The order's invoice total, not the order's (the delivery is invoiced on its own).
          vars: expect.objectContaining({ total: "£570.00" }),
        }),
      );
    });

    it("two workers at once apply the rest once", async () => {
      await aimShop("live");
      const seeded = await seedPaidOrder(owner, { scope: "outside_uk", deliveryPence: 3_000 });
      await projection().project(seeded.event);
      const held = new InMemoryAccounting({
        orgs: { london_art_exchange: { vatRegistered: false } },
      });
      await drain(sender("live", held));
      const parked = (await documentsFor(seeded)).find((d) => d.laxReference.endsWith("-delivery"));
      await releaser(ZERO).service.release({ documentId: parked?.id as string, actorUserId: "s" });
      await drain(sender("live", held));
      // Four workers, each on its own connection pool, at the same moment; Books answers slowly,
      // so all four are inside the step together unless the invoice is held by one of them.
      const slow: InMemoryAccounting["remainders"] = {
        applyRemainder: async (application) => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return held.remainders.applyRemainder(application);
        },
      };
      const pools = Array.from({ length: 4 }, () => createDb(WORKER_URL || (OWNER_URL as string)));
      const ticks = await Promise.all(
        pools.map((db) =>
          new AccountingRemainder({
            remainders: createAccountingRepositories(db, { now: () => new Date() }).remainders,
            settings: repos.settingReader,
            portsByMode: { live: slow },
            log,
          }).tick(),
        ),
      );
      await Promise.all(pools.map((db) => closeDb(db)));
      const settled = await owner
        .select()
        .from(accountingDocumentEvent)
        .where(
          and(
            eq(accountingDocumentEvent.documentId, parked?.id as string),
            eq(accountingDocumentEvent.action, "apply_remainder"),
          ),
        );
      expect(settled).toHaveLength(1);
      expect(ticks.reduce((n, t) => n + t.applied, 0)).toBe(1);
      expect([
        ...held.remainderAppliedOf("shop", `LAX-SHOP-PAY-${seeded.orderId}`).values(),
      ]).toEqual([3_000]);
    });
  });

  describe("who the invoice email goes to (the order's owner now, while reachable)", () => {
    async function issuedLive(options: { guest?: boolean } = {}) {
      await aimShop("live");
      const seeded = await seedPaidOrder(owner, options);
      await projection().project(seeded.event);
      const held = new InMemoryAccounting({
        orgs: { london_art_exchange: { vatRegistered: false } },
      });
      await drain(sender("live", held));
      const invoice = (await documentsFor(seeded)).find(
        (d) => d.laxReference === `LAX-SHOP-INV-${seeded.orderId}`,
      );
      return { seeded, held, invoice };
    }

    async function skipReasonOf(documentId: string) {
      const [copy] = await owner
        .select()
        .from(accountingDocumentCopy)
        .where(eq(accountingDocumentCopy.documentId, documentId));
      return copy;
    }

    const closedAccount: readonly [string, (subject: string) => ReturnType<typeof sql>][] = [
      [
        "disabled",
        (subject) =>
          sql`update shop_user_profile set disabled_at = now() where identity_subject_id = ${subject}`,
      ],
      [
        "deletion requested",
        (subject) =>
          sql`update shop_user_profile set deletion_requested_at = now() where identity_subject_id = ${subject}`,
      ],
      // Nothing in LAX follows a merge to the surviving account yet, so a merged one gets nothing.
      [
        "merged",
        (subject) =>
          sql`update shop_user_profile set merged_into_subject_id = ${`${subject}-survivor`} where identity_subject_id = ${subject}`,
      ],
    ];

    for (const [label, close] of closedAccount) {
      it(`a ${label} account gets nothing: no_recipient, nothing queued`, async () => {
        const { seeded, held, invoice } = await issuedLive();
        await owner.execute(close(seeded.subject as string));
        const { service, enqueue } = copier("live", held.pdfs);
        await service.tick();
        expect(enqueue).not.toHaveBeenCalled();
        expect(await skipReasonOf(invoice?.id as string)).toMatchObject({
          emailSkipReason: "no_recipient",
          emailQueuedAt: null,
        });
        const queued = await owner
          .select()
          .from(emailOutbox)
          .where(eq(emailOutbox.idempotencyKey, `shop-invoice-issued:${invoice?.id}`));
        expect(queued).toEqual([]);
      });
    }

    it("an erased guest gets nothing: no_recipient, nothing queued", async () => {
      const { seeded, held, invoice } = await issuedLive({ guest: true });
      await owner.execute(
        sql`update shop_guest_customer set erased_at = now(), erased_by_subject_id = 'staff-erasure' where id = ${seeded.guestId}`,
      );
      const { service, enqueue } = copier("live", held.pdfs);
      await service.tick();
      expect(enqueue).not.toHaveBeenCalled();
      expect(await skipReasonOf(invoice?.id as string)).toMatchObject({
        emailSkipReason: "no_recipient",
      });
    });

    it("a guest who can be reached is sent the link that mails them a fresh one", async () => {
      const { seeded, held } = await issuedLive({ guest: true });
      const { service, enqueue } = copier("live", held.pdfs);
      await service.tick();
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          to: `guest-${seeded.tag}@integration.test`,
          vars: expect.objectContaining({ orderUrl: "https://shop.example.test/orders/guest" }),
        }),
      );
    });

    it("a refunded order's invoice is still emailed: a refund does not cancel the invoice", async () => {
      const { seeded, held } = await issuedLive();
      await owner.execute(
        sql`update shop_order set status = 'refunded' where id = ${seeded.orderId}`,
      );
      const { service, enqueue } = copier("live", held.pdfs);
      await service.tick();
      expect(enqueue).toHaveBeenCalledTimes(1);
    });
  });
});
