import { randomUUID } from "node:crypto";
import { type DestinationBinding, laxReference } from "@auction/accounting-domain";
import { createZohoBooksDryRunAdapter } from "@auction/accounting-zoho-books";
import {
  BID_ORG_ID,
  InMemoryAccounting,
  testOrgConfigs,
} from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import {
  accountingDocument,
  bidIdentityDirectory,
  bidInvoice,
  bidUserProfile,
  deliveryQuote,
  domainEvent,
  legalEntity,
  legalEntityInvoiceDetails,
  legalEntityMember,
  lot,
  payment,
  paymentGroup,
  paymentGroupDelivery,
  user,
} from "@auction/db/schema";
import { SELLER_RULE_VERSION } from "@auction/domain";
import { InvoiceRaiser } from "@auction/finance-runtime";
import {
  DrizzleBidAccountingFactsReader,
  DrizzleBidInvoiceRepository,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);

const RAISED_AT = new Date("2031-11-12T14:05:00Z");
const SETTLED_AT = new Date("2031-11-14T10:00:00Z");
type BooksMode = "dry_run" | "test_org" | "live";
const bound = (mode: BooksMode): DestinationBinding =>
  mode === "dry_run" ? {} : { [mode]: { bid: BID_ORG_ID } };
const log = { info: vi.fn(), warn: vi.fn() };

/** A buyer organisation (owner pays), a seller, and nothing won yet. Fixture data only. */
async function seedBuyer(db: Database) {
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
type Buyer = Awaited<ReturnType<typeof seedBuyer>>;

/** One more lot the buyer won, its invoice raised through the one raiser (hammer + premium). */
async function wonAndRaised(db: Database, buyer: Buyer, hammerPence: number, premiumPence: number) {
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
type Raised = Awaited<ReturnType<typeof wonAndRaised>>;

holdAccountingTablesLock({ beforeAll, afterAll });

describe.skipIf(!HAS_DB)("Bid payments to Books (integration)", { timeout: 60_000 }, () => {
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function aimBooks(mode: BooksMode) {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = 'off', books_mode = case product when 'bid' then ${mode} else 'off' end`);
  }

  async function publish(eventType: string, aggregateId: string, payload: Record<string, unknown>) {
    const [event] = await owner
      .insert(domainEvent)
      .values({
        aggregateType: eventType.split(".")[0] as string,
        aggregateId,
        eventType,
        payload,
        producer: "apps/api",
      })
      .returning();
    if (!event) throw new Error("no event");
    return event;
  }

  const capturedEvent = (paymentId: string, lotId: string, amountCents: number) =>
    publish("payment.captured", paymentId, {
      paymentId,
      lotId,
      userId: null,
      amountCents,
      capturedAt: SETTLED_AT.toISOString(),
      via: "stripe_checkout_webhook",
    });

  /**
   * Settles the invoices in one "Pay several" group (with courier quotes if given) as the API's
   * settlement does, and writes its payment_group.settled event, references only.
   */
  async function settleGroup(
    buyer: Buyer,
    invoices: readonly Raised[],
    deliveryPence: number[] = [],
  ) {
    const lotsPence = invoices.reduce(
      (sum, r) => sum + Math.round(Number(r.payment.amount) * 100),
      0,
    );
    const totalPence = lotsPence + deliveryPence.reduce((sum, p) => sum + p, 0);
    const [group] = await owner
      .insert(paymentGroup)
      .values({
        buyerLegalEntityId: buyer.buyerEntityId,
        createdByUserId: buyer.buyerId,
        status: "paid",
        currency: "GBP",
        totalAmount: (totalPence / 100).toFixed(2),
        checkoutRail: "card",
        settledAt: SETTLED_AT,
      })
      .returning({ id: paymentGroup.id });
    const groupId = group?.id as string;
    const paymentIds = invoices.map((r) => r.payment.id);
    await owner
      .update(payment)
      .set({ paymentGroupId: groupId, status: "captured" })
      .where(inArray(payment.id, paymentIds));
    const quoteIds: string[] = [];
    for (const [index, pence] of deliveryPence.entries()) {
      const lotId = invoices[index]?.payment.lotId as string;
      const [quote] = await owner
        .insert(deliveryQuote)
        .values({
          lotId,
          buyerLegalEntityId: buyer.buyerEntityId,
          status: "accepted",
          destination: "Fixture address",
          amount: (pence / 100).toFixed(2),
        })
        .returning({ id: deliveryQuote.id });
      await owner.insert(paymentGroupDelivery).values({
        paymentGroupId: groupId,
        deliveryQuoteId: quote?.id as string,
        lotId,
        amount: (pence / 100).toFixed(2),
      });
      quoteIds.push(quote?.id as string);
    }
    const event = await publish("payment_group.settled", groupId, {
      paymentGroupId: groupId,
      buyerLegalEntityId: buyer.buyerEntityId,
      paymentIds,
      deliveryQuoteIds: quoteIds,
      settledAt: SETTLED_AT.toISOString(),
    });
    return { groupId, event, quoteIds, totalPence };
  }

  function projection() {
    return new AccountingProjection({
      facts: new DrizzleBidAccountingFactsReader(worker),
      settings: repos.settingReader,
      registry: repos.registry,
    });
  }

  function sender(mode: BooksMode, ports: SenderPorts, batch?: number) {
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
      ...(batch ? { batch } : {}),
    });
  }

  const ref = (kind: "invoice" | "payment" | "contact", sourceId: string) => {
    const reference = laxReference("bid", kind, sourceId);
    if (!reference.ok) throw new Error(reference.refusal.message);
    return reference.value;
  };

  async function rowOf(reference: string, mode: BooksMode) {
    const [row] = await owner
      .select()
      .from(accountingDocument)
      .where(
        and(
          eq(accountingDocument.laxReference, reference),
          eq(accountingDocument.targetMode, mode),
        ),
      );
    if (!row) throw new Error(`no document ${reference}`);
    return row;
  }

  it("card, one lot, in dry run: the payment follows its invoice into the clearing account, and nothing leaves", async () => {
    await aimBooks("dry_run");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const buyer = await seedBuyer(owner);
    const raised = await wonAndRaised(owner, buyer, 120_000, 30_000);
    const event = await capturedEvent(raised.payment.id, raised.payment.lotId, 150_000);
    expect(await projection().project(event)).toMatchObject({ created: 3, parked: 0 });
    const dryRun = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
    await sender("dry_run", dryRun).tick();

    const paymentRow = await rowOf(ref("payment", raised.payment.id), "dry_run");
    expect(paymentRow).toMatchObject({
      state: "issued",
      providerNumber: "DRY-RUN",
      grossPence: 150_000,
    });
    expect(paymentRow.payload).toMatchObject({
      amountPence: 150_000,
      currency: "GBP",
      allocations: [{ invoiceReference: ref("invoice", raised.invoice.id), amountPence: 150_000 }],
      unallocatedPence: 0,
    });
    const invoiceRow = await rowOf(ref("invoice", raised.invoice.id), "dry_run");
    expect(invoiceRow.state).toBe("issued");
    // The invoice reached the (rehearsed) books before the payment that is applied to it.
    expect(invoiceRow.updatedAt.getTime()).toBeLessThanOrEqual(paymentRow.updatedAt.getTime());
    // A dry run holds no HTTP client: nothing was sent anywhere.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("bank transfer: nothing while it is part funded; the payment once all of it is applied", async () => {
    await aimBooks("dry_run");
    const buyer = await seedBuyer(owner);
    const raised = await wonAndRaised(owner, buyer, 80_000, 20_000);
    const part = await publish("payment.bank_transfer_partially_funded", raised.payment.id, {
      paymentId: raised.payment.id,
      lotId: raised.payment.lotId,
      buyerUserId: buyer.buyerId,
      amountCents: 100_000,
      amountRemainingCents: 40_000,
      currency: "GBP",
    });
    expect(await projection().project(part)).toEqual({
      outcome: "skipped",
      reason: "not_an_accounting_event",
    });
    const none = await owner
      .select()
      .from(accountingDocument)
      .where(eq(accountingDocument.laxReference, ref("payment", raised.payment.id)));
    expect(none).toEqual([]);
    const full = await capturedEvent(raised.payment.id, raised.payment.lotId, 100_000);
    expect(await projection().project(full)).toMatchObject({ created: 3 });
    expect((await rowOf(ref("payment", raised.payment.id), "dry_run")).grossPence).toBe(100_000);
  });

  it("Pay several: ONE payment applied to each invoice exactly; it waits for an invoice the books refused, and posts once", async () => {
    await aimBooks("test_org");
    const buyer = await seedBuyer(owner);
    const a = await wonAndRaised(owner, buyer, 3_333, 0);
    const b = await wonAndRaised(owner, buyer, 3_333, 0);
    const c = await wonAndRaised(owner, buyer, 2_667, 667);
    const { groupId, event, totalPence } = await settleGroup(buyer, [a, b, c]);
    expect(totalPence).toBe(10_000);
    expect(await projection().project(event)).toMatchObject({ created: 5, parked: 0 });

    const books = new InMemoryAccounting();
    const paymentRef = ref("payment", `grp-${groupId}`);
    // The contact goes; then the books refuse the next invoice (a locked period).
    await sender("test_org", books, 1).tick();
    books.faults.inject("locked_period");
    await sender("test_org", books).tick();
    const states = await Promise.all(
      [a, b, c].map(async (r) => (await rowOf(ref("invoice", r.invoice.id), "test_org")).state),
    );
    expect(states.filter((s) => s === "issued")).toHaveLength(2);
    expect(states.filter((s) => s === "failed")).toHaveLength(1);
    // The payment waits, untried, and nothing is posted for it.
    expect(await rowOf(paymentRef, "test_org")).toMatchObject({ state: "pending", attempts: 0 });
    const paymentDoc = (await rowOf(paymentRef, "test_org")).payload;
    expect(await books.lookup.findDocument(paymentDoc as never)).toEqual({ status: "not_found" });

    // A person tries the refused invoice again: it is issued, and the payment follows, once.
    const failed = [a, b, c].find((_, i) => states[i] === "failed") as Raised;
    const failedRow = await rowOf(ref("invoice", failed.invoice.id), "test_org");
    expect((await repos.transitions.apply(failedRow.id, { action: "requeue" })).ok).toBe(true);
    await sender("test_org", books).tick();
    const paid = await rowOf(paymentRef, "test_org");
    expect(paid).toMatchObject({ state: "issued", attempts: 1, grossPence: 10_000 });
    expect(paid.payload).toMatchObject({ amountPence: 10_000, unallocatedPence: 0 });
    const allocations = (paid.payload as { allocations: { amountPence: number }[] }).allocations;
    expect(allocations.map((x) => x.amountPence).sort()).toEqual([3_333, 3_333, 3_334]);

    // Redelivered: a replay, and the sender has nothing more to post.
    expect(await projection().project(event)).toMatchObject({ created: 0, replayed: 5 });
    expect(await sender("test_org", books).tick()).toMatchObject({ sent: 0 });
    expect((await rowOf(paymentRef, "test_org")).attempts).toBe(1);
  });

  it("Pay several with a courier quote: the delivery invoice and the payment wait for the accountant, the lots go", async () => {
    await aimBooks("dry_run");
    const buyer = await seedBuyer(owner);
    const a = await wonAndRaised(owner, buyer, 50_000, 12_500);
    const b = await wonAndRaised(owner, buyer, 10_000, 2_500);
    const { groupId, event, quoteIds } = await settleGroup(buyer, [a, b], [4_501]);
    expect(await projection().project(event)).toMatchObject({ created: 5, parked: 2 });
    const dryRun = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
    await sender("dry_run", dryRun).tick();

    for (const r of [a, b]) {
      expect((await rowOf(ref("invoice", r.invoice.id), "dry_run")).state).toBe("issued");
    }
    const delivery = await rowOf(ref("invoice", `dlv-${quoteIds[0]}`), "dry_run");
    const groupPayment = await rowOf(ref("payment", `grp-${groupId}`), "dry_run");
    for (const parked of [delivery, groupPayment]) {
      expect(parked).toMatchObject({
        state: "needs_review",
        reviewLookup: "clear",
        needsReviewReason: "accounting_parked_vat_on_delivery",
        attempts: 0,
        provider: null,
      });
      // Never tried again by hand: the domain and the table both refuse it.
      expect(await repos.transitions.apply(parked.id, { action: "requeue" })).toMatchObject({
        ok: false,
        refusal: { code: "parked" },
      });
    }
    expect(delivery.grossPence).toBe(4_501);
    expect(groupPayment.grossPence).toBe(62_500 + 12_500 + 4_501);
    // The Accounting page lists them under "Needs a person".
    const page = await repos.browser.list({
      tab: "needs_person",
      legalEntity: null,
      reference: ref("payment", `grp-${groupId}`),
      limit: 10,
      offset: 0,
    });
    expect(page.documents.map((d) => d.reference)).toEqual([ref("payment", `grp-${groupId}`)]);
  });

  it("parks a payment for an invoice cancelled after it was paid; the invoice is not booked again", async () => {
    await aimBooks("dry_run");
    const buyer = await seedBuyer(owner);
    const raised = await wonAndRaised(owner, buyer, 20_000, 5_000);
    await owner
      .update(bidInvoice)
      .set({ voidedAt: SETTLED_AT })
      .where(eq(bidInvoice.id, raised.invoice.id));
    const event = await capturedEvent(raised.payment.id, raised.payment.lotId, 25_000);
    expect(await projection().project(event)).toMatchObject({ created: 2, parked: 1 });
    expect(await rowOf(ref("payment", raised.payment.id), "dry_run")).toMatchObject({
      state: "needs_review",
      needsReviewReason: "accounting_parked_invoice_cancelled",
    });
    const invoices = await owner
      .select()
      .from(accountingDocument)
      .where(eq(accountingDocument.laxReference, ref("invoice", raised.invoice.id)));
    expect(invoices).toEqual([]);
  });

  it("projects one payment when the same payment_group.settled is delivered concurrently", async () => {
    await aimBooks("dry_run");
    const buyer = await seedBuyer(owner);
    const a = await wonAndRaised(owner, buyer, 40_000, 10_000);
    const b = await wonAndRaised(owner, buyer, 8_000, 2_000);
    const { groupId, event } = await settleGroup(buyer, [a, b], [3_000]);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => projection().project(event)),
    );
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    const totals = results.reduce(
      (sum, r) => {
        const value = (r as PromiseFulfilledResult<{ created: number; parked: number }>).value;
        return { created: sum.created + value.created, parked: sum.parked + value.parked };
      },
      { created: 0, parked: 0 },
    );
    // Contact, two invoices, the delivery invoice and the payment: each created once, two parked.
    expect(totals).toEqual({ created: 5, parked: 2 });
    const payments = await owner
      .select()
      .from(accountingDocument)
      .where(eq(accountingDocument.laxReference, ref("payment", `grp-${groupId}`)));
    expect(payments).toHaveLength(1);
  });
});
