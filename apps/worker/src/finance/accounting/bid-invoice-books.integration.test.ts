import { randomUUID } from "node:crypto";
import { type DestinationBinding, invoiceStanding, laxReference } from "@auction/accounting-domain";
import { createZohoBooksDryRunAdapter } from "@auction/accounting-zoho-books";
import {
  BID_ORG_ID,
  InMemoryAccounting,
  testOrgConfigs,
} from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentCopy,
  accountingDocumentEvent,
  bidIdentityDirectory,
  bidInvoice,
  bidInvoiceLine,
  bidUserProfile,
  domainEvent,
  emailOutbox,
  legalEntity,
  legalEntityInvoiceDetails,
  legalEntityMember,
  lot,
  user,
} from "@auction/db/schema";
import { SELLER_RULE_VERSION } from "@auction/domain";
import { PostmarkEmailService } from "@auction/email";
import { InvoiceRaiser } from "@auction/finance-runtime";
import {
  DrizzleBidAccountingFactsReader,
  DrizzleBidInvoiceRepository,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { and, asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import {
  AccountingInvoiceCopy,
  type AccountingInvoiceCopyDeps,
} from "./accounting-invoice-copy.service.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
/** The buyer's card is read by the Bid API (api_app reads the event log; the worker does not). */
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);

const RAISED_AT = new Date("2031-11-12T14:05:00Z");
type BooksMode = "dry_run" | "test_org" | "live";
/** The in-memory Books answers as one organisation; each case binds it for the mode it uses. */
const bound = (mode: BooksMode): DestinationBinding =>
  mode === "dry_run" ? {} : { [mode]: { bid: BID_ORG_ID } };
const log = { info: vi.fn(), warn: vi.fn() };

/**
 * A buyer organisation (with a billing email) that has won one lot; the buyer is its owner, so
 * they pay. Fixture data only.
 */
async function seedWonLot(db: Database) {
  const tag = randomUUID().slice(0, 8);
  const buyerId = `books-bid-${tag}`;
  const sellerEntityId = randomUUID();
  const buyerEntityId = randomUUID();
  const lotId = randomUUID();
  await db.insert(user).values({
    id: buyerId,
    name: `Buyer ${tag}`,
    email: `${buyerId}@integration.test`,
    emailVerified: true,
    createdAt: RAISED_AT,
    updatedAt: RAISED_AT,
  });
  await db
    .insert(bidUserProfile)
    .values({ userId: buyerId, createdAt: RAISED_AT, updatedAt: RAISED_AT });
  await db.insert(bidIdentityDirectory).values({
    subjectId: buyerId,
    email: `${buyerId}@integration.test`,
    name: `Buyer ${tag}`,
    identityCreatedAt: RAISED_AT,
  });
  await db.insert(legalEntity).values(
    [sellerEntityId, buyerEntityId].map((id) => ({
      id,
      displayName: `Display ${tag}`,
      legalName: id === buyerEntityId ? `Collector Ltd ${tag}` : null,
      kind: "organisation" as const,
      subkind: "gallery" as const,
      createdByUserId: buyerId,
      status: "approved" as const,
      createdAt: RAISED_AT,
      updatedAt: RAISED_AT,
    })),
  );
  await db.insert(legalEntityMember).values({
    legalEntityId: buyerEntityId,
    userId: buyerId,
    role: "owner",
    acceptedAt: RAISED_AT,
    createdAt: RAISED_AT,
  });
  await db
    .insert(legalEntityInvoiceDetails)
    .values({ legalEntityId: buyerEntityId, billingEmail: `accounts-${tag}@integration.test` });
  await db.insert(lot).values({
    id: lotId,
    sellerLegalEntityId: sellerEntityId,
    title: `Harbour at dusk ${tag}`,
    images: [],
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: "1200.00",
    minBidIncrement: "10.00",
    startTime: new Date(RAISED_AT.getTime() - 86_400_000),
    endTime: RAISED_AT,
    status: "ended" as const,
    winnerId: buyerId,
    buyerLegalEntityId: buyerEntityId,
    createdAt: RAISED_AT,
    updatedAt: RAISED_AT,
  });
  return { tag, buyerId, sellerEntityId, buyerEntityId, lotId };
}

const PREMIUM_LABEL = "Buyer's premium (25% to £100,000, then 20%)";

/** Raises the lot's invoice through the one raiser, as checkout and lot end do. */
async function raise(db: Database, seeded: Awaited<ReturnType<typeof seedWonLot>>, payer?: string) {
  const raiser = new InvoiceRaiser({
    invoices: new DrizzleBidInvoiceRepository(db),
    sales: null,
    now: () => RAISED_AT,
  });
  const theLot = {
    id: seeded.lotId,
    winnerId: seeded.buyerId,
    buyerLegalEntityId: seeded.buyerEntityId,
    sellerLegalEntityId: seeded.sellerEntityId,
  } as Lot;
  return raiser.raise({
    lot: theLot,
    priced: {
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 120_000 },
        { kind: "buyers_premium", label: PREMIUM_LABEL, ratePercent: null, amountPence: 30_000 },
      ],
      totalPence: 150_000,
      policyId: null,
      existing: null,
    },
    payment: {
      lotId: seeded.lotId,
      paidByUserId: payer ?? seeded.buyerId,
      buyerLegalEntityId: seeded.buyerEntityId,
      sellerLegalEntityId: seeded.sellerEntityId,
      platformFee: "0.00",
      stripePaymentIntentId: null,
    },
    sellerTerms: {
      basis: "held",
      heldReason: "no_agreement",
      lotId: seeded.lotId,
      sellerLegalEntityId: seeded.sellerEntityId,
      hammerPence: 120_000,
      premiumPence: 30_000,
      ruleVersion: SELLER_RULE_VERSION,
    },
  });
}

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)("Bid invoices to Books (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  const repos = createAccountingRepositories(worker, { now: () => new Date() });
  const api = createDb(API_URL || (OWNER_URL as string));
  const apiRepos = createAccountingRepositories(api, { now: () => new Date() });

  afterAll(async () => {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
    await closeDb(owner);
    await closeDb(worker);
    await closeDb(api);
  });

  beforeEach(async () => {
    // Nothing left over from another case or suite for the sender to claim.
    await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending', 'failed', 'unknown')`);
  });

  async function aimBooks(mode: BooksMode) {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'bid' then ${mode} else 'off' end`);
  }

  async function raisedEvent(invoiceId: string) {
    const [event] = await owner
      .select()
      .from(domainEvent)
      .where(
        and(eq(domainEvent.eventType, "invoice.raised"), eq(domainEvent.aggregateId, invoiceId)),
      );
    if (!event) throw new Error("no invoice.raised event");
    return event;
  }

  function projection() {
    return new AccountingProjection({
      facts: new DrizzleBidAccountingFactsReader(worker),
      settings: repos.settingReader,
      registry: repos.registry,
    });
  }

  function sender(mode: BooksMode, ports: SenderPorts) {
    let n = 0;
    return new AccountingSender({
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
  }

  function copier(
    mode: BooksMode,
    ports: SenderPorts & Pick<InMemoryAccounting, "pdfs">,
    batch = 1_000,
  ) {
    const putObject = vi.fn(async (_key: string, _body: Buffer, _type: string) => ({
      url: "unused",
    }));
    const enqueue = vi.fn(async () => ({ outboxId: randomUUID() }));
    const service = new AccountingInvoiceCopy({
      copies: repos.copies,
      settings: repos.settingReader,
      pdfsByMode: { [mode]: ports.pdfs },
      storage: { putObject },
      emailFacts: repos.invoiceEmailFacts,
      email: { enqueue },
      webBaseUrl: "https://lax.bid",
      now: () => new Date(),
      log,
      // Other suites leave issued rows this copier cannot fetch (their adapters are gone, and
      // some are dated ahead by their own clocks); a wide batch always reaches this case's row.
      batch,
    });
    return { service, putObject, enqueue };
  }

  /** A copier writing to the real email outbox (the worker role), its queue a spy. */
  function outboxCopier(books: InMemoryAccounting, batch = 1_000) {
    const add = vi.fn(async () => ({}));
    const service = new AccountingInvoiceCopy({
      copies: repos.copies,
      settings: repos.settingReader,
      pdfsByMode: { live: books.pdfs },
      storage: { putObject: vi.fn(async () => ({})) },
      emailFacts: repos.invoiceEmailFacts,
      email: new PostmarkEmailService(worker, { add } as never),
      webBaseUrl: "https://lax.bid",
      now: () => new Date(),
      log,
      batch,
    });
    return { service, add };
  }

  /** Settles every copy still due from earlier cases, so this case owns the head of the list. */
  async function settleEarlierCopies() {
    await owner.execute(sql`
      update accounting_document_copy
         set email_skipped_at = now(), email_skip_reason = 'invoice_missing'
       where email_queued_at is null and email_skipped_at is null and not rehearsal`);
  }

  /** Raises, projects and issues (live) one won lot's invoice, then stores its copy only. */
  async function issuedLiveWithCopy(books: InMemoryAccounting) {
    const seeded = await seedWonLot(owner);
    const raised = await raise(owner, seeded);
    await projection().project(await raisedEvent(raised.invoice.id));
    await sender("live", books).tick();
    const state = await apiRepos.bidInvoiceBooks.read(raised.invoice.id);
    if (!state.ok || !state.value?.invoices[0]) throw new Error("not issued");
    const documentId = state.value.invoices[0].documentId;
    const storeOnly = new AccountingInvoiceCopy({
      copies: repos.copies,
      settings: repos.settingReader,
      pdfsByMode: { live: books.pdfs },
      storage: { putObject: vi.fn(async () => ({})) },
      emailFacts: repos.invoiceEmailFacts,
      email: {
        enqueue: vi.fn(async () => {
          throw new Error("store step only");
        }),
      },
      webBaseUrl: "https://lax.bid",
      now: () => new Date(),
      log,
      batch: 1_000,
    });
    await storeOnly.tick();
    const [copy] = await owner
      .select()
      .from(accountingDocumentCopy)
      .where(eq(accountingDocumentCopy.documentId, documentId));
    if (!copy || copy.emailQueuedAt || copy.emailSkippedAt) throw new Error("no due copy");
    return { seeded, raised, documentId };
  }

  async function copyOf(documentId: string) {
    const [copy] = await owner
      .select()
      .from(accountingDocumentCopy)
      .where(eq(accountingDocumentCopy.documentId, documentId));
    return copy;
  }

  it("writes invoice.raised in the raiser's transaction, naming the frozen lines and nothing personal", async () => {
    const seeded = await seedWonLot(owner);
    const raised = await raise(owner, seeded);
    const lines = await owner
      .select({ id: bidInvoiceLine.id })
      .from(bidInvoiceLine)
      .where(eq(bidInvoiceLine.invoiceId, raised.invoice.id))
      .orderBy(asc(bidInvoiceLine.position));
    const event = await raisedEvent(raised.invoice.id);
    expect(event.payload).toEqual({
      invoiceId: raised.invoice.id,
      lotId: seeded.lotId,
      buyerLegalEntityId: seeded.buyerEntityId,
      totalPence: 150_000,
      raisedAt: RAISED_AT.toISOString(),
      lineIds: lines.map((l) => l.id),
    });
    expect(JSON.stringify(event.payload)).not.toContain("@");
    expect(JSON.stringify(event.payload)).not.toContain(seeded.tag);

    // A raise that fails after the invoice row (its payment names no such member) leaves neither
    // the invoice nor its event: they are one transaction.
    const other = await seedWonLot(owner);
    await expect(raise(owner, other, "no-such-member")).rejects.toThrow();
    expect(await owner.select().from(bidInvoice).where(eq(bidInvoice.lotId, other.lotId))).toEqual(
      [],
    );
    const orphan = await owner
      .select()
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, "invoice.raised"),
          sql`${domainEvent.payload} ->> 'lotId' = ${other.lotId}`,
        ),
      );
    expect(orphan).toEqual([]);
  });

  it("projects the invoice once for Books from its frozen lines; a redelivery is a replay", async () => {
    await aimBooks("dry_run");
    const seeded = await seedWonLot(owner);
    const raised = await raise(owner, seeded);
    const event = await raisedEvent(raised.invoice.id);
    const first = await projection().project(event);
    expect(first).toEqual({ outcome: "projected", created: 2, replayed: 0, kept: 0, parked: 0 });
    const again = await projection().project(event);
    expect(again).toEqual({ outcome: "projected", created: 0, replayed: 2, kept: 0, parked: 0 });

    const reference = laxReference("bid", "invoice", raised.invoice.id);
    if (!reference.ok) throw new Error("reference");
    const rows = await owner
      .select()
      .from(accountingDocument)
      .where(eq(accountingDocument.laxReference, reference.value));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ targetMode: "dry_run", grossPence: 150_000, state: "pending" });
    const payload = rows[0]?.payload as { lines: { description: string }[] };
    // The premium is booked under the label it was raised with, never worked out again.
    expect(payload.lines.map((l) => l.description)).toEqual(["Hammer price", PREMIUM_LABEL]);
  });

  it("dry run: rehearses, keeps a stand-in copy, and sends nothing to Books or to the buyer", async () => {
    await aimBooks("dry_run");
    const seeded = await seedWonLot(owner);
    const raised = await raise(owner, seeded);
    await projection().project(await raisedEvent(raised.invoice.id));
    const dryRun = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
    await sender("dry_run", dryRun).tick();
    const { service, putObject, enqueue } = copier("dry_run", dryRun);
    const tick = await service.tick();
    expect(tick.emailed).toBe(0);

    const state = await apiRepos.bidInvoiceBooks.read(raised.invoice.id);
    if (!state.ok || !state.value) throw new Error("state");
    const [document] = state.value.invoices;
    expect(document?.record).toMatchObject({ status: "issued", issued: { number: "DRY-RUN" } });
    expect(document?.copy).toMatchObject({ rehearsal: true });
    // This case's own copy was stored once (other rehearsed rows in the shared database may be too).
    const key = `accounting/london_auction_xchange/${document?.documentId}.pdf`;
    expect(document?.copy?.storageKey).toBe(key);
    expect(putObject.mock.calls.filter(([stored]) => stored === key)).toHaveLength(1);
    expect(enqueue).not.toHaveBeenCalled();
    // A rehearsal can never be marked emailed: the store and the table both refuse it.
    if (!document) throw new Error("document");
    expect(await repos.copies.markEmailQueued(document.documentId, randomUUID(), new Date())).toBe(
      false,
    );
    await expect(
      owner
        .update(accountingDocumentCopy)
        .set({ emailQueuedAt: new Date(), emailOutboxId: randomUUID() })
        .where(eq(accountingDocumentCopy.documentId, document.documentId)),
    ).rejects.toThrow();
    // The buyer keeps LAX's own invoice: a rehearsal never shows a Books number.
    expect(
      invoiceStanding(
        {
          raisedAtMs: raised.invoice.raisedAt.getTime(),
          cancelledAtMs: null,
          booksMode: "dry_run",
          document: { record: document.record, copyStored: true },
        },
        Date.now(),
      ),
    ).toEqual({ kind: "lax" });
  });

  it("holds an invoice whose Books total differs for a person, with Books' figure kept", async () => {
    await aimBooks("test_org");
    const seeded = await seedWonLot(owner);
    const raised = await raise(owner, seeded);
    await projection().project(await raisedEvent(raised.invoice.id));
    const books = new InMemoryAccounting();
    // The contact takes the first (a contact has no totals); the invoice comes back 1p out.
    books.faults.inject("totals_drift");
    books.faults.inject("totals_drift");
    await sender("test_org", books).tick();

    const reference = laxReference("bid", "invoice", raised.invoice.id);
    if (!reference.ok) throw new Error("reference");
    const [row] = await owner
      .select()
      .from(accountingDocument)
      .where(eq(accountingDocument.laxReference, reference.value));
    expect(row).toMatchObject({
      state: "needs_review",
      mismatchField: "vatPence",
      mismatchDifferencePence: 1,
      grossPence: 150_000,
    });
    // Still being prepared: once 30 minutes have passed the watch counts it as delayed.
    const createdAt = row?.createdAt ?? new Date();
    const before = await repos.attention.delayedBidInvoices(["test_org"], createdAt);
    const after = await repos.attention.delayedBidInvoices(
      ["test_org"],
      new Date(createdAt.getTime() + 1),
    );
    expect(after.count).toBe(before.count + 1);
    expect(await repos.attention.delayedBidInvoices([], new Date())).toEqual({
      count: 0,
      oldestSince: null,
    });
    // Not issued, so no copy and no email: the buyer's invoice is still being prepared.
    const { service, enqueue } = copier("test_org", books);
    expect(await service.tick()).toEqual({ stored: 0, emailed: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("test organisation: keeps the Books copy, emails no one, and the buyer keeps LAX's invoice", async () => {
    await aimBooks("test_org");
    await settleEarlierCopies();
    const seeded = await seedWonLot(owner);
    const raised = await raise(owner, seeded);
    await projection().project(await raisedEvent(raised.invoice.id));
    const books = new InMemoryAccounting();
    await sender("test_org", books).tick();
    const { service, enqueue } = copier("test_org", books);
    expect(await service.tick()).toMatchObject({ stored: 1, emailed: 0 });
    expect(enqueue).not.toHaveBeenCalled();
    // Not listed as due either: the query only lists invoices Books issued live.
    const due = await repos.copies.listEmailDue(1_000);
    const state = await apiRepos.bidInvoiceBooks.read(raised.invoice.id);
    if (!state.ok || !state.value?.invoices[0]) throw new Error("state");
    const [document] = state.value.invoices;
    expect(due.due.map((d) => d.documentId)).not.toContain(document.documentId);
    expect(document.copy).toMatchObject({ rehearsal: false });
    expect(
      invoiceStanding(
        {
          raisedAtMs: raised.invoice.raisedAt.getTime(),
          cancelledAtMs: null,
          booksMode: "test_org",
          document: { record: document.record, copyStored: true },
        },
        Date.now(),
      ),
    ).toEqual({ kind: "lax" });
  });

  it("live: stores the Books PDF, emails the invoice once, and the card shows its number", async () => {
    await aimBooks("live");
    const seeded = await seedWonLot(owner);
    const raised = await raise(owner, seeded);
    await projection().project(await raisedEvent(raised.invoice.id));
    const books = new InMemoryAccounting();
    await sender("live", books).tick();
    const { service, enqueue } = copier("live", books);
    expect(await service.tick()).toMatchObject({ stored: 1, emailed: 1 });
    expect(await service.tick()).toEqual({ stored: 0, emailed: 0 });
    // The payer and the billing inbox, once each.
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "bid-invoice-issued",
        to: `${seeded.buyerId}@integration.test`,
        vars: expect.objectContaining({
          lotTitle: `Harbour at dusk ${seeded.tag}`,
          total: "£1,500.00",
          settlement: {
            kind: "due",
            by: expect.stringMatching(/^\w{3} \d{1,2} Nov( 2031)?, 23:59 GMT$/),
          },
        }),
      }),
    );

    const state = await apiRepos.bidInvoiceBooks.read(raised.invoice.id);
    if (!state.ok || !state.value) throw new Error("state");
    const [document] = state.value.invoices;
    if (!document) throw new Error("document");
    expect(document.copy).toMatchObject({ rehearsal: false });
    expect(
      invoiceStanding(
        {
          raisedAtMs: raised.invoice.raisedAt.getTime(),
          cancelledAtMs: null,
          booksMode: "live",
          document: { record: document.record, copyStored: document.copy !== null },
        },
        Date.now(),
      ),
    ).toEqual({ kind: "issued", number: expect.stringMatching(/^INV-\d{6}$/) });
  });

  it("dates 'Issued' from the issue event, not from the row's last change", async () => {
    await aimBooks("live");
    const books = new InMemoryAccounting();
    const { raised, documentId } = await issuedLiveWithCopy(books);
    const [event] = await owner
      .select({ at: accountingDocumentEvent.occurredAt })
      .from(accountingDocumentEvent)
      .where(
        and(
          eq(accountingDocumentEvent.documentId, documentId),
          eq(accountingDocumentEvent.toState, "issued"),
        ),
      );
    if (!event) throw new Error("no issue event");
    // A later write to the row (a repair, a requeue tool) moves updated_at, never "Issued".
    const later = new Date(event.at.getTime() + 3 * 86_400_000);
    await owner
      .update(accountingDocument)
      .set({ updatedAt: later })
      .where(eq(accountingDocument.id, documentId));
    const state = await apiRepos.bidInvoiceBooks.read(raised.invoice.id);
    if (!state.ok || !state.value?.invoices[0]) throw new Error("state");
    expect(state.value.invoices[0].issuedAt?.toISOString()).toBe(event.at.toISOString());
    expect(state.value.invoices[0].issuedAt?.toISOString()).not.toBe(later.toISOString());
  });

  it("a cancelled invoice at the head of the email list is settled, and the one behind it is emailed", async () => {
    await aimBooks("live");
    await settleEarlierCopies();
    const books = new InMemoryAccounting();
    const a = await issuedLiveWithCopy(books);
    await owner
      .update(bidInvoice)
      .set({ voidedAt: new Date() })
      .where(eq(bidInvoice.id, a.raised.invoice.id));
    const b = await issuedLiveWithCopy(books);
    // A's copy was stored first, so it heads the list; one at a time.
    const narrow = outboxCopier(books, 1);
    await narrow.service.tick();
    expect(await copyOf(a.documentId)).toMatchObject({
      emailSkipReason: "invoice_cancelled",
      emailQueuedAt: null,
    });
    expect((await copyOf(a.documentId))?.emailSkippedAt).not.toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      { documentId: a.documentId, reason: "invoice_cancelled" },
      "accounting_invoice_email_skipped",
    );
    await narrow.service.tick();
    expect((await copyOf(b.documentId))?.emailQueuedAt).not.toBeNull();
    const keys = await owner
      .select({ key: emailOutbox.idempotencyKey })
      .from(emailOutbox)
      .where(sql`${emailOutbox.idempotencyKey} like ${`%${a.documentId}`}`);
    expect(keys).toEqual([]);
  });

  it("emails a former member nothing: only the account's billing inbox gets the invoice", async () => {
    await aimBooks("live");
    await settleEarlierCopies();
    const books = new InMemoryAccounting();
    const removed = await issuedLiveWithCopy(books);
    await owner
      .update(legalEntityMember)
      .set({ removedAt: new Date() })
      .where(eq(legalEntityMember.userId, removed.seeded.buyerId));
    // A member who stays but no longer moves the account's money is not the payer either.
    const demoted = await issuedLiveWithCopy(books);
    await owner
      .update(legalEntityMember)
      .set({ role: "viewer" })
      .where(eq(legalEntityMember.userId, demoted.seeded.buyerId));
    const { service } = outboxCopier(books);
    await service.tick();
    for (const { seeded, documentId } of [removed, demoted]) {
      const sent = await owner
        .select({ to: emailOutbox.toSnapshot, key: emailOutbox.idempotencyKey })
        .from(emailOutbox)
        .where(sql`${emailOutbox.idempotencyKey} like ${`%${documentId}`}`);
      expect(sent).toEqual([
        {
          to: `accounts-${seeded.tag}@integration.test`,
          key: `bid-invoice-issued-billing:${seeded.buyerEntityId}:${documentId}`,
        },
      ]);
      expect((await copyOf(documentId))?.emailQueuedAt).not.toBeNull();
    }
  });

  it("the worker role can settle an email once and never undo or change it", async () => {
    await aimBooks("live");
    await settleEarlierCopies();
    const books = new InMemoryAccounting();
    const queued = await issuedLiveWithCopy(books);
    const skipped = await issuedLiveWithCopy(books);
    const outboxId = randomUUID();
    expect(await repos.copies.markEmailQueued(queued.documentId, outboxId, new Date())).toBe(true);
    expect(
      await repos.copies.markEmailSkipped(skipped.documentId, "no_recipient", new Date()),
    ).toBe(true);
    // Settled once: the store says no to a second note of either kind.
    expect(await repos.copies.markEmailQueued(queued.documentId, randomUUID(), new Date())).toBe(
      false,
    );
    expect(await repos.copies.markEmailQueued(skipped.documentId, randomUUID(), new Date())).toBe(
      false,
    );
    // And the table refuses the worker role directly: no clearing, no rewriting, no both.
    const c = accountingDocumentCopy;
    const attempts = [
      worker
        .update(c)
        .set({ emailQueuedAt: null, emailOutboxId: null })
        .where(eq(c.documentId, queued.documentId)),
      worker
        .update(c)
        .set({ emailOutboxId: randomUUID() })
        .where(eq(c.documentId, queued.documentId)),
      worker
        .update(c)
        .set({ emailQueuedAt: new Date() })
        .where(eq(c.documentId, queued.documentId)),
      worker
        .update(c)
        .set({ emailSkippedAt: null, emailSkipReason: null })
        .where(eq(c.documentId, skipped.documentId)),
      worker
        .update(c)
        .set({ emailSkipReason: "invoice_missing" })
        .where(eq(c.documentId, skipped.documentId)),
      worker
        .update(c)
        .set({ emailQueuedAt: new Date(), emailOutboxId: randomUUID() })
        .where(eq(c.documentId, skipped.documentId)),
    ];
    for (const attempt of attempts) {
      await expect(attempt).rejects.toThrow();
    }
    expect(await copyOf(queued.documentId)).toMatchObject({
      emailOutboxId: outboxId,
      emailSkippedAt: null,
    });
    expect(await copyOf(skipped.documentId)).toMatchObject({
      emailSkipReason: "no_recipient",
      emailQueuedAt: null,
    });
    // As the worker role itself, when the suite has its URL (CI may run as the owner).
    const who = (await worker.execute(sql`select current_user as name`)) as unknown as {
      rows: { name: string }[];
    };
    expect(who.rows[0]?.name).toBe(WORKER_URL ? "worker_app" : "postgres");
  });
});

describe.skipIf(!HAS_DB)(
  "Bid invoices to Books under concurrency (integration)",
  { timeout: 60_000 },
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const owner = createDb(OWNER_URL!);
    const worker = createDb(WORKER_URL || (OWNER_URL as string));
    const repos = createAccountingRepositories(worker, { now: () => new Date() });
    const api = createDb(API_URL || (OWNER_URL as string));
    const apiRepos = createAccountingRepositories(api, { now: () => new Date() });

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
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'bid' then 'live' else 'off' end`);
    });

    function projection() {
      return new AccountingProjection({
        facts: new DrizzleBidAccountingFactsReader(worker),
        settings: repos.settingReader,
        registry: repos.registry,
      });
    }

    async function raisedEvent(invoiceId: string) {
      const [event] = await owner
        .select()
        .from(domainEvent)
        .where(
          and(eq(domainEvent.eventType, "invoice.raised"), eq(domainEvent.aggregateId, invoiceId)),
        );
      if (!event) throw new Error("no invoice.raised event");
      return event;
    }

    function copierOf(books: InMemoryAccounting, email: AccountingInvoiceCopyDeps["email"]) {
      return new AccountingInvoiceCopy({
        copies: repos.copies,
        settings: repos.settingReader,
        pdfsByMode: { live: books.pdfs },
        storage: { putObject: vi.fn(async () => ({})) },
        emailFacts: repos.invoiceEmailFacts,
        email,
        webBaseUrl: "https://lax.bid",
        now: () => new Date(),
        log,
        batch: 1_000,
      });
    }

    it("emails once per document when many workers tick at the same moment (real outbox)", async () => {
      await owner.execute(sql`
      update accounting_document_copy
         set email_skipped_at = now(), email_skip_reason = 'invoice_missing'
       where email_queued_at is null and email_skipped_at is null and not rehearsal`);
      const books = new InMemoryAccounting();
      const seeded = await seedWonLot(owner);
      const raised = await raise(owner, seeded);
      await projection().project(await raisedEvent(raised.invoice.id));
      let n = 0;
      await new AccountingSender({
        workQueue: repos.workQueue,
        dueWork: repos.dueWork,
        transitions: repos.transitions,
        settings: repos.settingReader,
        portsByMode: { live: books },
        destinations: bound("live"),
        transientErrorPrefixes: [],
        newLeaseToken: () => `lease-${randomUUID()}-${++n}`,
        log,
      }).tick();
      // Store the copy only (the email step throws and is retried later).
      await copierOf(books, {
        enqueue: vi.fn(async () => {
          throw new Error("store step only");
        }),
      }).tick();
      const state = await apiRepos.bidInvoiceBooks.read(raised.invoice.id);
      const documentId = state.ok ? state.value?.invoices[0]?.documentId : undefined;
      if (!documentId) throw new Error("no document");

      const copiers = Array.from({ length: 6 }, () => {
        const add = vi.fn(async () => ({}));
        return {
          add,
          service: copierOf(books, new PostmarkEmailService(worker, { add } as never)),
        };
      });
      await Promise.all(copiers.map((c) => c.service.tick()));
      await Promise.all(copiers.map((c) => c.service.tick()));
      const rows = await owner
        .select({ key: emailOutbox.idempotencyKey })
        .from(emailOutbox)
        .where(sql`${emailOutbox.idempotencyKey} like ${`%${documentId}`}`);
      expect(rows.map((r) => r.key).sort()).toEqual(
        [
          `bid-invoice-issued-billing:${seeded.buyerEntityId}:${documentId}`,
          `bid-invoice-issued:${documentId}`,
        ].sort(),
      );
      // Every racing enqueue re-adds the same pending row; the queue dedupes by job id = outbox id.
      const jobIds = new Set(
        copiers
          .flatMap((c) => c.add.mock.calls as unknown[][])
          .map((call) => (call[2] as { jobId?: string } | undefined)?.jobId),
      );
      expect(jobIds.size).toBe(2);
      const [copy] = await owner
        .select()
        .from(accountingDocumentCopy)
        .where(eq(accountingDocumentCopy.documentId, documentId));
      expect(copy?.emailQueuedAt).not.toBeNull();
      expect(copy?.emailSkippedAt).toBeNull();
    });

    it("projects one document when the same invoice.raised is delivered concurrently", async () => {
      const seeded = await seedWonLot(owner);
      const raised = await raise(owner, seeded);
      const event = await raisedEvent(raised.invoice.id);
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () => projection().project(event)),
      );
      expect(results.filter((r) => r.status === "rejected")).toEqual([]);
      const created = results.reduce(
        (sum, r) =>
          sum + (r.status === "fulfilled" ? ((r.value as { created?: number }).created ?? 0) : 0),
        0,
      );
      const reference = laxReference("bid", "invoice", raised.invoice.id);
      if (!reference.ok) throw new Error("reference");
      const documents = await owner
        .select()
        .from(accountingDocument)
        .where(eq(accountingDocument.laxReference, reference.value));
      expect(documents).toHaveLength(1);
      // The contact and the invoice, each created once.
      expect(created).toBe(2);
    });
  },
);
