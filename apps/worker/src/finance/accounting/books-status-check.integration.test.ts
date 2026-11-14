import { randomUUID } from "node:crypto";
import { laxReference } from "@auction/accounting-domain";
import { BID_ORG_ID, InMemoryAccounting } from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import {
  accountingBooksStatus,
  accountingBooksStatusChange,
  accountingBooksStatusRun,
  accountingDocument,
  bidIdentityDirectory,
  bidInvoice,
  bidUserProfile,
  domainEvent,
  legalEntity,
  legalEntityInvoiceDetails,
  legalEntityMember,
  lot,
  payment,
  user,
} from "@auction/db/schema";
import { SELLER_RULE_VERSION } from "@auction/domain";
import { InvoiceRaiser, UnappliedMoneyRecorder } from "@auction/finance-runtime";
import {
  DrizzleBidAccountingFactsReader,
  DrizzleBidInvoiceRepository,
  DrizzleTransactionRunner,
  DrizzleUnappliedMoneyReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerDomainEventPublisher } from "../../lib/domain-event-publisher.js";
import { WorkerDomainEventSink } from "../../lib/worker-domain-event-sink.js";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";
import { AccountingStatusCheck } from "./accounting-status-check.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);
const SETTLED_AT = new Date("2031-11-14T10:00:00Z");
const log = { info: vi.fn(), warn: vi.fn() };

// The seeding below is the same as the Bid payments integration's (test files only: the worker's
// own code never writes Identity's user table).
/** When the fixture's lots end and their invoices are raised. */
export const RAISED_AT = new Date("2031-11-12T14:05:00Z");

/** A buyer organisation (owner pays), a seller, and nothing won yet. Fixture data only. */
export async function seedBuyer(db: Database) {
  const tag = randomUUID().slice(0, 8);
  const buyerId = `books-pay-${tag}`;
  const sellerEntityId = randomUUID();
  const buyerEntityId = randomUUID();
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
  return { tag, buyerId, sellerEntityId, buyerEntityId };
}
export type Buyer = Awaited<ReturnType<typeof seedBuyer>>;

/** One more lot the buyer won, its invoice raised through the one raiser (hammer + premium). */
export async function wonAndRaised(
  db: Database,
  buyer: Buyer,
  hammerPence: number,
  premiumPence: number,
) {
  const lotId = randomUUID();
  await db.insert(lot).values({
    id: lotId,
    sellerLegalEntityId: buyer.sellerEntityId,
    title: `Study ${buyer.tag}`,
    images: [],
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: (hammerPence / 100).toFixed(2),
    minBidIncrement: "10.00",
    startTime: new Date(RAISED_AT.getTime() - 86_400_000),
    endTime: RAISED_AT,
    status: "ended" as const,
    winnerId: buyer.buyerId,
    buyerLegalEntityId: buyer.buyerEntityId,
    createdAt: RAISED_AT,
    updatedAt: RAISED_AT,
  });
  const raiser = new InvoiceRaiser({
    invoices: new DrizzleBidInvoiceRepository(db),
    sales: null,
    now: () => RAISED_AT,
  });
  return raiser.raise({
    lot: {
      id: lotId,
      winnerId: buyer.buyerId,
      buyerLegalEntityId: buyer.buyerEntityId,
      sellerLegalEntityId: buyer.sellerEntityId,
    } as Lot,
    priced: {
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: hammerPence },
        {
          kind: "buyers_premium",
          label: "Buyer's premium",
          ratePercent: null,
          amountPence: premiumPence,
        },
      ],
      totalPence: hammerPence + premiumPence,
      policyId: null,
      existing: null,
    },
    payment: {
      lotId,
      paidByUserId: buyer.buyerId,
      buyerLegalEntityId: buyer.buyerEntityId,
      sellerLegalEntityId: buyer.sellerEntityId,
      platformFee: "0.00",
      stripePaymentIntentId: null,
    },
    sellerTerms: {
      basis: "held",
      heldReason: "no_agreement",
      lotId,
      sellerLegalEntityId: buyer.sellerEntityId,
      hammerPence,
      premiumPence,
      ruleVersion: SELLER_RULE_VERSION,
    },
  });
}
export type Raised = Awaited<ReturnType<typeof wonAndRaised>>;

holdAccountingTablesLock({ beforeAll, afterAll });

/**
 * The nightly status check on Postgres 16, run as worker_app (when DATABASE_URL_WORKER is set):
 * Bid documents issued to the Books fake, then changed "by hand" in Books.
 */
describe.skipIf(!HAS_DB)("Books nightly status check (integration)", { timeout: 60_000 }, () => {
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
    await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending', 'failed', 'unknown')`);
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'bid' then 'test_org' else 'off' end`);
  });

  const ref = (kind: "invoice" | "payment", sourceId: string) => {
    const r = laxReference("bid", kind, sourceId);
    if (!r.ok) throw new Error(r.refusal.message);
    return r.value;
  };

  /** A won lot, paid by card, its contact, invoice and payment issued to the Books fake. */
  async function issued() {
    const buyer = await seedBuyer(owner);
    const raised: Raised = await wonAndRaised(owner, buyer, 120_000, 30_000);
    await owner
      .update(payment)
      .set({ status: "captured" })
      .where(eq(payment.id, raised.payment.id));
    const [event] = await owner
      .insert(domainEvent)
      .values({
        aggregateType: "payment",
        aggregateId: raised.payment.id,
        eventType: "payment.captured",
        payload: {
          paymentId: raised.payment.id,
          lotId: raised.payment.lotId,
          userId: null,
          amountCents: 150_000,
          capturedAt: SETTLED_AT.toISOString(),
          via: "stripe_checkout_webhook",
        },
        producer: "apps/api",
      })
      .returning();
    if (!event) throw new Error("no event");
    await new AccountingProjection({
      facts: new DrizzleBidAccountingFactsReader(worker),
      settings: repos.settingReader,
      registry: repos.registry,
    }).project(event);
    const books = new InMemoryAccounting();
    let n = 0;
    await new AccountingSender({
      workQueue: repos.workQueue,
      dueWork: repos.dueWork,
      transitions: repos.transitions,
      settings: repos.settingReader,
      portsByMode: { test_org: books },
      destinations: { test_org: { bid: BID_ORG_ID } },
      transientErrorPrefixes: [],
      newLeaseToken: () => `lease-${randomUUID()}-${++n}`,
      log,
    }).tick();
    const rowOf = async (reference: string) => {
      const [row] = await owner
        .select()
        .from(accountingDocument)
        .where(
          and(
            eq(accountingDocument.laxReference, reference),
            eq(accountingDocument.targetMode, "test_org"),
          ),
        );
      if (!row?.providerId || row.state !== "issued") throw new Error(`not issued ${reference}`);
      return row;
    };
    const invoice = await rowOf(ref("invoice", raised.invoice.id));
    const laxPayment = await rowOf(ref("payment", raised.payment.id));
    return { raised, books, invoice, laxPayment };
  }

  function statusCheck(books: InMemoryAccounting) {
    const sink = new WorkerDomainEventSink(
      new WorkerDomainEventPublisher({ publishValidateMode: "enforce" }),
      worker,
    );
    const recorder = new UnappliedMoneyRecorder(new DrizzleUnappliedMoneyReader(worker), sink);
    return new AccountingStatusCheck({
      store: repos.booksStatus,
      statusesByMode: { test_org: books.statuses },
      organisationIds: { london_auction_xchange: BID_ORG_ID },
      tasks: { open: (tx, money) => recorder.record(tx, money, null) },
      transactions: new DrizzleTransactionRunner(worker),
      log,
      now: () => new Date(),
      // Every issued document in the shared database is due; the share is not what is tested here.
      allowance: { maxCalls: 10_000, keepFree: 0 },
    });
  }

  /**
   * Everything that could say a lot or invoice is paid: the whole invoice, payment and lot rows.
   * None of it may move because of Books.
   */
  async function moneyState(raised: Raised) {
    const [inv] = await owner.select().from(bidInvoice).where(eq(bidInvoice.id, raised.invoice.id));
    const [pay] = await owner.select().from(payment).where(eq(payment.id, raised.payment.id));
    const [won] = await owner.select().from(lot).where(eq(lot.id, raised.payment.lotId));
    if (!inv || !pay || !won) throw new Error("fixture rows missing");
    return { invoice: inv, payment: pay, lot: won };
  }

  const tasksFor = (dedupeKey: string) =>
    owner
      .select()
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, "payment.unapplied_money_received"),
          sql`${domainEvent.payload}->>'dedupeKey' = ${dedupeKey}`,
        ),
      );

  it("a payment recorded by hand in Books: one finance task, recorded once, and nothing in LAX marked paid", async () => {
    const { raised, books, invoice, laxPayment } = await issued();
    // Before the cheque: pretend the invoice is still unpaid in LAX, so "paid" would be a change.
    await owner.update(payment).set({ status: "pending" }).where(eq(payment.id, raised.payment.id));
    const before = await moneyState(raised);
    const cheque = String(7_000_000_000_000 + Math.floor(Math.random() * 1e9));
    books.setStatus(invoice.providerId as string, {
      status: "read",
      reading: {
        state: "paid",
        balancePence: 0,
        payments: [
          // LAX's own payment, then the cheque someone typed into Books.
          {
            providerPaymentId: laxPayment.providerId as string,
            amountPence: 150_000,
            date: "2031-11-14",
            mode: "Stripe",
          },
          { providerPaymentId: cheque, amountPence: 150_000, date: "2031-11-15", mode: "Cheque" },
        ],
      },
    });

    const check = statusCheck(books);
    const first = await check.runNightly();
    expect(first.outcome).toBe("completed");

    const key = `books_payment_recorded_by_hand:books:${BID_ORG_ID}:${cheque}`;
    const tasks = await tasksFor(key);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.payload).toMatchObject({
      reason: "books_payment_recorded_by_hand",
      accountingReference: invoice.laxReference,
      booksPaymentMode: "Cheque",
      amountCents: 150_000,
      currency: "GBP",
      paymentId: null,
    });
    const changes = await owner
      .select()
      .from(accountingBooksStatusChange)
      .where(eq(accountingBooksStatusChange.documentId, invoice.id));
    expect(changes.map((c) => [c.change, c.toState ?? c.booksPaymentId])).toEqual(
      expect.arrayContaining([
        ["state_changed", "paid"],
        ["payment_recorded_in_books", cheque],
      ]),
    );
    // LAX's own payment is never a task.
    expect(changes.some((c) => c.booksPaymentId === laxPayment.providerId)).toBe(false);

    // The second night sees the same cheque: no second task, no second change.
    await check.runNightly();
    expect(await tasksFor(key)).toHaveLength(1);
    expect(
      await owner
        .select()
        .from(accountingBooksStatusChange)
        .where(eq(accountingBooksStatusChange.documentId, invoice.id)),
    ).toHaveLength(changes.length);

    // The rule that matters: nothing that says paid moved because Books said so.
    expect(await moneyState(raised)).toEqual(before);
    const [doc] = await owner
      .select({ state: accountingDocument.state })
      .from(accountingDocument)
      .where(eq(accountingDocument.id, invoice.id));
    expect(doc?.state).toBe("issued");
  });

  it("a void made in Books is recorded as a change, the run is recorded, and a notice reads it first", async () => {
    const { books, invoice } = await issued();
    const check = statusCheck(books);
    await check.runNightly();
    books.setStatus(invoice.providerId as string, {
      status: "read",
      reading: { state: "void", balancePence: null, payments: [] },
    });
    expect(
      await check.recheckFromNotice({
        organizationId: BID_ORG_ID,
        module: "invoice",
        entityId: invoice.providerId as string,
      }),
    ).toBe("read");
    const [status] = await owner
      .select()
      .from(accountingBooksStatus)
      .where(eq(accountingBooksStatus.documentId, invoice.id));
    expect(status).toMatchObject({ booksState: "void", recheckRequestedAt: null });
    const [lastChange] = await owner
      .select()
      .from(accountingBooksStatusChange)
      .where(eq(accountingBooksStatusChange.documentId, invoice.id))
      .orderBy(sql`${accountingBooksStatusChange.id} desc`)
      .limit(1);
    expect(lastChange).toMatchObject({
      change: "state_changed",
      fromState: "open",
      toState: "void",
    });
    expect(await repos.booksStatus.lastFinishedRunAt()).toBeInstanceOf(Date);
    const runs = await owner
      .select()
      .from(accountingBooksStatusRun)
      .orderBy(sql`${accountingBooksStatusRun.startedAt} desc`)
      .limit(1);
    expect(runs[0]?.outcome).toBe("completed");
  });
});
