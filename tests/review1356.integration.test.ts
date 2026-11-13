import { randomUUID } from "node:crypto";
import { type DestinationBinding, laxReference } from "@auction/accounting-domain";
import { BID_ORG_ID, InMemoryAccounting } from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentCopy,
  bidIdentityDirectory,
  bidInvoice,
  bidUserProfile,
  domainEvent,
  legalEntity,
  legalEntityInvoiceDetails,
  lot,
  user,
} from "@auction/db/schema";
import { emailOutbox } from "@auction/db/schema";
import { SELLER_RULE_VERSION } from "@auction/domain";
import { PostmarkEmailService } from "@auction/email";
import { InvoiceRaiser } from "@auction/finance-runtime";
import {
  DrizzleBidAccountingFactsReader,
  DrizzleBidInvoiceRepository,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingInvoiceCopy } from "./accounting-invoice-copy.service.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);

const RAISED_AT = new Date("2031-11-12T14:05:00Z");
const BOUND: DestinationBinding = { test_org: { bid: BID_ORG_ID } };
const log = { info: vi.fn(), warn: vi.fn() };

/** A buyer organisation (with a billing email) that has won one lot. Fixture data only. */
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
describe.skipIf(!HAS_DB)("review 1356: concurrency", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  const repos = createAccountingRepositories(worker, { now: () => new Date() });

  afterAll(async () => {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
    await closeDb(owner);
    await closeDb(worker);
  });

  beforeEach(async () => {
    // Nothing left over from another case or suite for the sender to claim.
    await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending', 'failed', 'unknown')`);
  });

  async function aimBooks(mode: "dry_run" | "test_org") {
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

  function sender(mode: "dry_run" | "test_org", ports: SenderPorts) {
    let n = 0;
    return new AccountingSender({
      workQueue: repos.workQueue,
      dueWork: repos.dueWork,
      transitions: repos.transitions,
      settings: repos.settingReader,
      portsByMode: { [mode]: ports },
      destinations: BOUND,
      transientErrorPrefixes: [],
      newLeaseToken: () => `lease-${randomUUID()}-${++n}`,
      log,
    });
  }

  async function issuedCopied(
    seeded: Awaited<ReturnType<typeof seedWonLot>>,
    books: InMemoryAccounting,
  ) {
    const raised = await raise(owner, seeded);
    await projection().project(await raisedEvent(raised.invoice.id));
    await sender("test_org", books).tick();
    const store = new AccountingInvoiceCopy({
      copies: repos.copies,
      settings: repos.settingReader,
      pdfsByMode: { test_org: books.pdfs },
      storage: { putObject: vi.fn(async () => ({})) },
      emailFacts: repos.invoiceEmailFacts,
      email: {
        enqueue: vi.fn(async () => {
          throw new Error("not in store step");
        }),
      },
      webBaseUrl: "https://lax.bid",
      now: () => new Date(),
      log,
      batch: 1_000,
    });
    // store only: email step throws and is swallowed per copy
    await store.tick();
    const state = await repos.bidInvoiceBooks.read(raised.invoice.id);
    if (!state.ok || !state.value?.invoices[0]?.copy) throw new Error("no copy");
    return { raised, documentId: state.value.invoices[0].documentId };
  }

  function realOutboxCopier(books: InMemoryAccounting, batch: number) {
    const add = vi.fn(async () => ({}));
    const outbox = new PostmarkEmailService(worker, { add } as never);
    const service = new AccountingInvoiceCopy({
      copies: repos.copies,
      settings: repos.settingReader,
      pdfsByMode: { test_org: books.pdfs },
      storage: { putObject: vi.fn(async () => ({})) },
      emailFacts: repos.invoiceEmailFacts,
      email: outbox,
      webBaseUrl: "https://lax.bid",
      now: () => new Date(),
      log,
      batch,
    });
    return { service, add };
  }

  it("emails once per document when many workers tick at the same moment (real outbox)", async () => {
    await aimBooks("test_org");
    // clear earlier due rows so this case owns the due list
    await owner.execute(
      sql`update accounting_document_copy set email_queued_at = now(), email_outbox_id = gen_random_uuid() where email_queued_at is null and not rehearsal`,
    );
    const books = new InMemoryAccounting();
    const seeded = await seedWonLot(owner);
    const { documentId } = await issuedCopied(seeded, books);
    const copiers = Array.from({ length: 6 }, () => realOutboxCopier(books, 1_000));
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
    const adds = copiers.flatMap((c) => c.add.mock.calls);
    // Every racing enqueue re-adds the same pending row; BullMQ dedupes by jobId = outbox id.
    const jobIds = new Set(
      adds.map(
        (call) => (call as unknown[])[2] && ((call as unknown[])[2] as { jobId: string }).jobId,
      ),
    );
    expect(jobIds.size).toBe(2);
    const [copy] = await owner
      .select()
      .from(accountingDocumentCopy)
      .where(eq(accountingDocumentCopy.documentId, documentId));
    expect(copy?.emailQueuedAt).not.toBeNull();
  });

  it("projects one document when the same invoice.raised is delivered concurrently", async () => {
    await aimBooks("test_org");
    const seeded = await seedWonLot(owner);
    const raised = await raise(owner, seeded);
    const event = await raisedEvent(raised.invoice.id);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => projection().project(event)),
    );
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const created = ok.reduce((n, r) => n + ((r as { created?: number }).created ?? 0), 0);
    const reference = laxReference("bid", "invoice", raised.invoice.id);
    if (!reference.ok) throw new Error("reference");
    const docs = await owner
      .select()
      .from(accountingDocument)
      .where(eq(accountingDocument.laxReference, reference.value));
    expect(docs).toHaveLength(1);
    expect(created).toBe(2); // contact + invoice, once
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
  });

  it("a cancelled invoice at the head of the email queue holds back the ones behind it", async () => {
    await aimBooks("test_org");
    // Leave no other due copy ahead of this case.
    await owner.execute(
      sql`update accounting_document_copy set email_queued_at = now(), email_outbox_id = gen_random_uuid() where email_queued_at is null and not rehearsal`,
    );
    const books = new InMemoryAccounting();
    const a = await issuedCopied(await seedWonLot(owner), books);
    await owner
      .update(bidInvoice)
      .set({ voidedAt: new Date() })
      .where(eq(bidInvoice.id, a.raised.invoice.id));
    const b = await issuedCopied(await seedWonLot(owner), books);
    const narrow = realOutboxCopier(books, 1);
    for (let i = 0; i < 3; i += 1) await narrow.service.tick();
    const [copyB] = await owner
      .select()
      .from(accountingDocumentCopy)
      .where(eq(accountingDocumentCopy.documentId, b.documentId));
    // Documents the behaviour: B is never reached while A (never marked) sits first.
    expect(copyB?.emailQueuedAt).toBeNull();
    expect(narrow.add).not.toHaveBeenCalled();
  });
});
