import { randomUUID } from "node:crypto";
import {
  DELIVERY_BOOKING,
  type DestinationBinding,
  type LineBooking,
  laxReference,
} from "@auction/accounting-domain";
import { BID_ORG_ID, InMemoryAccounting } from "@auction/accounting-zoho-books/testing";
import { type Database, closeDb, createDb } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentEvent,
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
import { AccountingQueueService, InvoiceRaiser } from "@auction/finance-runtime";
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
const API_URL = process.env.DATABASE_URL_API;
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

describe.skipIf(!HAS_DB)(
  "Bid payments to Books: guards under concurrency and stored rows (integration)",
  { timeout: 60_000 },
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const owner = createDb(OWNER_URL!);
    const worker = createDb(WORKER_URL || (OWNER_URL as string));
    const api = createDb(API_URL || (OWNER_URL as string));
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

    async function publish(
      eventType: string,
      aggregateId: string,
      payload: Record<string, unknown>,
    ) {
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

    it("R1: six senders tick at once; each document posts once, invoices after their contact, the payment after every invoice", async () => {
      await aimBooks("test_org");
      const buyer = await seedBuyer(owner);
      const a = await wonAndRaised(owner, buyer, 3_333, 0);
      const b = await wonAndRaised(owner, buyer, 3_333, 0);
      const c = await wonAndRaised(owner, buyer, 2_667, 667);
      const { groupId, event } = await settleGroup(buyer, [a, b, c]);
      await projection().project(event);
      const books = new InMemoryAccounting();
      const order: string[] = [];
      const pay = books.payments.recordPayment.bind(books.payments);
      const inv = books.invoices.issueInvoice.bind(books.invoices);
      (books.payments as { recordPayment: unknown }).recordPayment = vi.fn(async (d, f) => {
        order.push(`pay:${d.reference}`);
        return pay(d, f);
      });
      (books.invoices as { issueInvoice: unknown }).issueInvoice = vi.fn(async (d, f) => {
        order.push(`inv:${d.reference}`);
        return inv(d, f);
      });
      for (let round = 0; round < 4; round++) {
        await Promise.all(Array.from({ length: 6 }, () => sender("test_org", books, 1).tick()));
      }
      const paymentRef = ref("payment", `grp-${groupId}`);
      const row = await rowOf(paymentRef, "test_org");
      // Every document is posted exactly once, whatever order the senders reached them in.
      const counts = new Map<string, number>();
      for (const o of order) counts.set(o, (counts.get(o) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === 1)).toBe(true);
      // Strict: the payment is posted, once, after every invoice it pays, on its first attempt.
      const payIndex = order.indexOf(`pay:${paymentRef}`);
      expect(payIndex).toBeGreaterThan(0);
      for (const r of [a, b, c]) {
        const invIndex = order.indexOf(`inv:${ref("invoice", r.invoice.id)}`);
        expect(invIndex).toBeGreaterThanOrEqual(0);
        expect(invIndex).toBeLessThan(payIndex);
      }
      expect(row).toMatchObject({ state: "issued", attempts: 1 });
      for (const r of [a, b, c]) {
        expect(await rowOf(ref("invoice", r.invoice.id), "test_org")).toMatchObject({
          state: "issued",
          attempts: 1,
        });
      }
    });

    it("R2: a member's own payment.captured is skipped (the group books it): no double posting", async () => {
      await aimBooks("dry_run");
      const buyer = await seedBuyer(owner);
      const a = await wonAndRaised(owner, buyer, 10_000, 2_500);
      const b = await wonAndRaised(owner, buyer, 10_000, 2_500);
      const { event } = await settleGroup(buyer, [a, b]);
      expect(await projection().project(event)).toMatchObject({ created: 4 });
      const member = await capturedEvent(a.payment.id, a.payment.lotId, 12_500);
      expect(await projection().project(member)).toEqual({
        outcome: "skipped",
        reason: "payment_in_group",
      });
      const own = await owner
        .select()
        .from(accountingDocument)
        .where(eq(accountingDocument.laxReference, ref("payment", a.payment.id)));
      expect(own).toEqual([]);
    });

    it("R3: a stored group total 1p over or under its rows is refused and nothing is stored", async () => {
      await aimBooks("dry_run");
      for (const delta of [1, -1]) {
        const buyer = await seedBuyer(owner);
        const a = await wonAndRaised(owner, buyer, 10_000, 2_500);
        const { groupId, event } = await settleGroup(buyer, [a], [1_000]);
        await owner.execute(
          sql`update payment_group set total_amount = total_amount + ${delta / 100} where id = ${groupId}`,
        );
        await expect(projection().project(event)).rejects.toThrow(/allocation/);
        const rows = await owner
          .select()
          .from(accountingDocument)
          .where(eq(accountingDocument.laxReference, ref("payment", `grp-${groupId}`)));
        expect(rows).toEqual([]);
      }
    });

    it("R4: an invoice of another account in the group is refused", async () => {
      await aimBooks("dry_run");
      const buyer = await seedBuyer(owner);
      const other = await seedBuyer(owner);
      const a = await wonAndRaised(owner, buyer, 10_000, 2_500);
      const x = await wonAndRaised(owner, other, 10_000, 2_500);
      const { event } = await settleGroup(buyer, [a, x]);
      await expect(projection().project(event)).rejects.toThrow(/another account|buyer_mismatch/);
    });

    it("R5: rows added to the group after the event are refused without retry", async () => {
      await aimBooks("dry_run");
      const buyer = await seedBuyer(owner);
      const a = await wonAndRaised(owner, buyer, 10_000, 2_500);
      const b = await wonAndRaised(owner, buyer, 10_000, 2_500);
      const { groupId, event } = await settleGroup(buyer, [a]);
      await owner
        .update(payment)
        .set({ paymentGroupId: groupId })
        .where(eq(payment.id, b.payment.id));
      await expect(projection().project(event)).rejects.toMatchObject({ retryable: false });
    });

    /**
     * Finance › Accounting as the Bid API runs it (api_app when it is configured, so the release
     * trigger is exercised), with the delivery booking a test chooses.
     */
    function staff(deliveryBooking: LineBooking | null) {
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
        deliveryBooking,
      });
      return { service, audits };
    }

    const release = (service: AccountingQueueService, documentId: string) =>
      service.release({ documentId, actorUserId: "staff-release-1" });

    async function historyOf(documentId: string) {
      return owner
        .select()
        .from(accountingDocumentEvent)
        .where(eq(accountingDocumentEvent.documentId, documentId))
        .orderBy(accountingDocumentEvent.id);
    }

    it("R6: the documented recovery, end to end: once the accountant's booking is set, Release rebuilds the delivery invoice and the payment follows its invoices into Books", async () => {
      expect(DELIVERY_BOOKING).toBeNull();
      await aimBooks("test_org");
      const buyer = await seedBuyer(owner);
      const a = await wonAndRaised(owner, buyer, 10_000, 2_500);
      const { groupId, event, quoteIds } = await settleGroup(buyer, [a], [1_000]);
      await projection().project(event);
      const books = new InMemoryAccounting();
      const order: string[] = [];
      const pay = books.payments.recordPayment.bind(books.payments);
      const inv = books.invoices.issueInvoice.bind(books.invoices);
      (books.payments as { recordPayment: unknown }).recordPayment = vi.fn(async (d, f) => {
        order.push(`pay:${d.reference}`);
        return pay(d, f);
      });
      (books.invoices as { issueInvoice: unknown }).issueInvoice = vi.fn(async (d, f) => {
        order.push(`inv:${d.reference}`);
        return inv(d, f);
      });
      const tick = async () => {
        for (let i = 0; i < 4; i++) await sender("test_org", books).tick();
      };
      await tick();
      const deliveryRef = ref("invoice", `dlv-${quoteIds[0]}`);
      const paymentRef = ref("payment", `grp-${groupId}`);
      const lotRef = ref("invoice", a.invoice.id);
      expect(order).toEqual([`inv:${lotRef}`]);
      const parkedDelivery = await rowOf(deliveryRef, "test_org");
      const parkedPayment = await rowOf(paymentRef, "test_org");

      // While the booking is not set, Release is refused and nothing changes.
      const waiting = staff(null);
      for (const row of [parkedDelivery, parkedPayment]) {
        expect(await release(waiting.service, row.id)).toMatchObject({
          ok: false,
          refusal: "unresolved",
        });
        expect(await rowOf(row.laxReference, "test_org")).toMatchObject({
          state: "needs_review",
          needsReviewReason: "accounting_parked_vat_on_delivery",
        });
      }
      expect(waiting.audits).toEqual([]);

      // The accountant answers: delivery is zero rated (what was charged stays the same).
      const answered = staff({ role: "delivery", treatment: "zero" });
      expect(await release(answered.service, parkedDelivery.id)).toEqual({
        ok: true,
        value: {
          id: parkedDelivery.id,
          reference: deliveryRef,
          outcome: "released",
          rebuilt: true,
        },
      });
      const rebuilt = await rowOf(deliveryRef, "test_org");
      expect(rebuilt).toMatchObject({ state: "pending", attempts: 0, grossPence: 1_000 });
      expect((rebuilt.payload as { lines: { treatment: string }[] }).lines[0]?.treatment).toBe(
        "zero",
      );
      expect((await historyOf(parkedDelivery.id)).at(-1)).toMatchObject({
        action: "release",
        fromState: "needs_review",
        toState: "pending",
        detail: { requestedBy: "staff-release-1", parked: "vat_on_delivery", rebuilt: true },
      });
      expect(await release(answered.service, parkedPayment.id)).toMatchObject({
        ok: true,
        value: { outcome: "released", rebuilt: false },
      });
      expect(answered.audits).toHaveLength(2);

      await tick();
      expect(order).toEqual([`inv:${lotRef}`, `inv:${deliveryRef}`, `pay:${paymentRef}`]);
      expect(await rowOf(deliveryRef, "test_org")).toMatchObject({ state: "issued", attempts: 1 });
      expect(await rowOf(paymentRef, "test_org")).toMatchObject({ state: "issued", attempts: 1 });
      // Released twice changes nothing more.
      expect(await release(answered.service, parkedPayment.id)).toMatchObject({
        ok: false,
        refusal: "not_allowed",
      });
    });

    it("R6b: a payment parked for a cancelled invoice is released once the invoice is reinstated, and is then booked", async () => {
      await aimBooks("test_org");
      const buyer = await seedBuyer(owner);
      const raised = await wonAndRaised(owner, buyer, 20_000, 5_000);
      const [raisedEvent] = await owner
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.eventType, "invoice.raised"),
            eq(domainEvent.aggregateId, raised.invoice.id),
          ),
        );
      if (!raisedEvent) throw new Error("no invoice.raised event");
      await projection().project(raisedEvent);
      await owner
        .update(bidInvoice)
        .set({ voidedAt: SETTLED_AT })
        .where(eq(bidInvoice.id, raised.invoice.id));
      const captured = await capturedEvent(raised.payment.id, raised.payment.lotId, 25_000);
      expect(await projection().project(captured)).toMatchObject({ parked: 1 });
      const paymentRow = await rowOf(ref("payment", raised.payment.id), "test_org");

      const desk = staff(null);
      expect(await release(desk.service, paymentRow.id)).toMatchObject({
        ok: false,
        refusal: "unresolved",
        message: expect.stringMatching(/still cancelled/),
      });

      // Reinstated in Bid: the payment is released unchanged and booked after its invoice.
      await owner
        .update(bidInvoice)
        .set({ voidedAt: null })
        .where(eq(bidInvoice.id, raised.invoice.id));
      expect(await release(desk.service, paymentRow.id)).toMatchObject({
        ok: true,
        value: { outcome: "released", rebuilt: false },
      });
      const books = new InMemoryAccounting();
      for (let i = 0; i < 4; i++) await sender("test_org", books).tick();
      expect(await rowOf(ref("invoice", raised.invoice.id), "test_org")).toMatchObject({
        state: "issued",
      });
      expect(await rowOf(ref("payment", raised.payment.id), "test_org")).toMatchObject({
        state: "issued",
        attempts: 1,
      });
    });

    it("F4: a payment whose invoice was cancelled in Accounting is parked for a person, not left waiting", async () => {
      await aimBooks("test_org");
      const buyer = await seedBuyer(owner);
      const a = await wonAndRaised(owner, buyer, 10_000, 2_500);
      const b = await wonAndRaised(owner, buyer, 8_000, 2_000);
      const { groupId, event } = await settleGroup(buyer, [a, b]);
      await projection().project(event);
      // Staff cancel one of its invoices before it is sent.
      const cancelled = await rowOf(ref("invoice", b.invoice.id), "test_org");
      expect((await repos.transitions.apply(cancelled.id, { action: "cancel" })).ok).toBe(true);
      const books = new InMemoryAccounting();
      let parked = 0;
      for (let i = 0; i < 3; i++) parked += (await sender("test_org", books).tick()).parked;
      expect(parked).toBe(1);
      const paymentRow = await rowOf(ref("payment", `grp-${groupId}`), "test_org");
      expect(paymentRow).toMatchObject({
        state: "needs_review",
        attempts: 0,
        needsReviewReason: "accounting_parked_invoice_cancelled",
      });
      expect((await historyOf(paymentRow.id)).at(-1)).toMatchObject({
        action: "park",
        fromState: "pending",
        toState: "needs_review",
      });
      // It cannot be released while that invoice stays cancelled in Accounting.
      expect(await release(staff(null).service, paymentRow.id)).toMatchObject({
        ok: false,
        refusal: "unresolved",
        message: expect.stringMatching(/cancelled in Accounting/),
      });
    });
  },
);
