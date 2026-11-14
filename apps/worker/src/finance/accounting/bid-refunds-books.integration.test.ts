import { randomUUID } from "node:crypto";
import {
  type BidDefaultTreatment,
  type CreditNote,
  type DestinationBinding,
  type Invoice,
  buildCreditNoteFor,
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
  paymentRefund,
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
import { AccountingCreditNoteRefund } from "./accounting-credit-note-refund.service.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);

const RAISED_AT = new Date("2031-11-12T14:05:00Z");
const SETTLED_AT = new Date("2031-11-14T10:00:00Z");
const REFUNDED_AT = new Date("2031-11-20T09:30:00Z");
type BooksMode = "dry_run" | "test_org" | "live";
const bound = (mode: BooksMode): DestinationBinding =>
  mode === "dry_run" ? {} : { [mode]: { bid: BID_ORG_ID } };
const log = { info: vi.fn(), warn: vi.fn() };

/** A buyer organisation (owner pays) and a seller. Fixture data only. */
async function seedBuyer(db: Database) {
  const tag = randomUUID().slice(0, 8);
  const buyerId = `books-refund-${tag}`;
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
  "Bid refunds to Books: credit notes (integration)",
  { timeout: 90_000 },
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
      await closeDb(api);
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
      occurredAt = REFUNDED_AT,
    ) {
      const [event] = await owner
        .insert(domainEvent)
        .values({
          aggregateType: eventType.split(".")[0] as string,
          aggregateId,
          eventType,
          payload,
          producer: "apps/api",
          occurredAt,
        })
        .returning();
      if (!event) throw new Error("no event");
      return event;
    }

    const capturedEvent = (r: Raised) =>
      publish(
        "payment.captured",
        r.payment.id,
        {
          paymentId: r.payment.id,
          lotId: r.payment.lotId,
          userId: null,
          amountCents: Math.round(Number(r.payment.amount) * 100),
          capturedAt: SETTLED_AT.toISOString(),
          via: "stripe_checkout_webhook",
        },
        SETTLED_AT,
      );

    /** A refund that went through, as every refund path records it (the row, then the event). */
    async function refunded(
      paymentId: string,
      amountPence: number,
      over: { source?: string; stripeRefundId?: string | null } = {},
    ) {
      const [row] = await owner
        .insert(paymentRefund)
        .values({
          paymentId,
          idempotencyKey: `fixture:${randomUUID()}`,
          stripeRefundId:
            over.stripeRefundId === undefined ? `re_${randomUUID()}` : over.stripeRefundId,
          amountPence,
          currency: "GBP",
          source: over.source ?? "staff",
          createdAt: REFUNDED_AT,
        })
        .returning();
      return row as typeof paymentRefund.$inferSelect;
    }

    const refundedEvent = (paymentId: string) =>
      publish("payment.refunded", paymentId, {
        amount: "0.00",
        currency: "GBP",
        sellerLegalEntityId: null,
        via: "admin_manual",
        stripeRefundId: null,
      });

    async function settleGroup(buyer: Buyer, invoices: readonly Raised[], deliveryPence: number[]) {
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
      const event = await publish(
        "payment_group.settled",
        groupId,
        {
          paymentGroupId: groupId,
          buyerLegalEntityId: buyer.buyerEntityId,
          paymentIds,
          deliveryQuoteIds: quoteIds,
          settledAt: SETTLED_AT.toISOString(),
        },
        SETTLED_AT,
      );
      return { groupId, event, quoteIds };
    }

    /** The projection as the worker runs it (worker_app), with the books view for refunds. */
    function projection() {
      return new AccountingProjection({
        facts: new DrizzleBidAccountingFactsReader(worker),
        settings: repos.settingReader,
        registry: repos.registry,
        books: {
          lookup: repos.lookup,
          creditNotes: repos.creditNotes,
          transitions: repos.transitions,
        },
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

    function refunder(mode: BooksMode, books: InMemoryAccounting) {
      return new AccountingCreditNoteRefund({
        refunds: repos.creditNoteRefunds,
        settings: repos.settingReader,
        portsByMode: { [mode]: books.creditNoteRefunds },
        log,
      });
    }

    async function sendAll(mode: BooksMode, books: InMemoryAccounting) {
      for (let round = 0; round < 6; round++) await sender(mode, books).tick();
    }

    const ref = (kind: "invoice" | "payment" | "contact" | "credit_note", sourceId: string) => {
      const reference = laxReference("bid", kind, sourceId);
      if (!reference.ok) throw new Error(reference.refusal.message);
      return reference.value;
    };

    async function rowsOf(where: ReturnType<typeof and>, mode: BooksMode) {
      return owner
        .select()
        .from(accountingDocument)
        .where(and(where, eq(accountingDocument.targetMode, mode)));
    }

    async function rowOf(reference: string, mode: BooksMode) {
      const [row] = await rowsOf(eq(accountingDocument.laxReference, reference), mode);
      if (!row) throw new Error(`no document ${reference}`);
      return row;
    }

    async function creditNotesOf(invoiceReference: string, mode: BooksMode) {
      return rowsOf(
        and(
          eq(accountingDocument.kind, "credit_note"),
          sql`${accountingDocument.payload} ->> 'invoiceReference' = ${invoiceReference}`,
        ),
        mode,
      );
    }

    /** A paid single invoice, projected and sent to the test organisation (in memory). */
    async function paidAndSent(books: InMemoryAccounting, hammer = 10_000, premium = 2_500) {
      await aimBooks("test_org");
      const buyer = await seedBuyer(owner);
      const raised = await wonAndRaised(owner, buyer, hammer, premium);
      await owner
        .update(payment)
        .set({ status: "captured" })
        .where(eq(payment.id, raised.payment.id));
      await projection().project(await capturedEvent(raised));
      await sendAll("test_org", books);
      expect(await rowOf(ref("invoice", raised.invoice.id), "test_org")).toMatchObject({
        state: "issued",
      });
      return { buyer, raised };
    }

    it("F8: a refund that went through is one credit note for exactly its amount, sent after its invoice, then refunded from clearing once", async () => {
      const books = new InMemoryAccounting();
      const { raised } = await paidAndSent(books);
      const row = await refunded(raised.payment.id, 4_321);
      expect(await projection().project(await refundedEvent(raised.payment.id))).toMatchObject({
        outcome: "projected",
        created: 1,
      });
      const noteRef = ref("credit_note", row.id.toLowerCase());
      expect(await rowOf(noteRef, "test_org")).toMatchObject({
        state: "pending",
        grossPence: 4_321,
        netPence: 4_321,
        vatPence: 0,
      });
      await sendAll("test_org", books);
      expect(await rowOf(noteRef, "test_org")).toMatchObject({ state: "issued", attempts: 1 });
      // Six refunders at once: the money goes back once, and the history says so once.
      await Promise.all(Array.from({ length: 6 }, () => refunder("test_org", books).tick()));
      expect(books.creditNoteRefundOf("bid", noteRef)).toBe(4_321);
      const document = await rowOf(noteRef, "test_org");
      const history = await owner
        .select()
        .from(accountingDocumentEvent)
        .where(
          and(
            eq(accountingDocumentEvent.documentId, document.id),
            eq(accountingDocumentEvent.action, "refund_credit_note"),
          ),
        );
      expect(history).toHaveLength(1);
      expect(history[0]?.detail).toMatchObject({ outcome: "refunded", amountPence: 4_321 });
      expect((await refunder("test_org", books).tick()).refunded).toBe(0);
    });

    it("F8: the same event six times at once, and again, makes one credit note per refund", async () => {
      const books = new InMemoryAccounting();
      const { raised } = await paidAndSent(books);
      await refunded(raised.payment.id, 1_000);
      await refunded(raised.payment.id, 2_000);
      const event = await refundedEvent(raised.payment.id);
      await Promise.all(Array.from({ length: 6 }, () => projection().project(event)));
      await projection().project(event);
      const notes = await creditNotesOf(ref("invoice", raised.invoice.id), "test_org");
      expect(notes.map((n) => n.grossPence).sort((a, b) => a - b)).toEqual([1_000, 2_000]);
    });

    it("F8: a refund counted then taken back (it failed) makes no credit note; an event with no refund makes nothing", async () => {
      const books = new InMemoryAccounting();
      const { raised } = await paidAndSent(books);
      expect(await projection().project(await refundedEvent(raised.payment.id))).toEqual({
        outcome: "skipped",
        reason: "no_refund_recorded",
      });
      const counted = await refunded(raised.payment.id, 3_000, {
        stripeRefundId: "re_fails_later",
      });
      await refunded(raised.payment.id, -3_000, {
        source: "refund_reversal",
        stripeRefundId: "re_fails_later",
      });
      expect(await projection().project(await refundedEvent(raised.payment.id))).toEqual({
        outcome: "skipped",
        reason: "no_refund_recorded",
      });
      expect(
        await rowsOf(
          eq(accountingDocument.laxReference, ref("credit_note", counted.id)),
          "test_org",
        ),
      ).toEqual([]);
    });

    it("F8: a reversal that matches no refund goes to a person, nothing is booked", async () => {
      const books = new InMemoryAccounting();
      const { raised } = await paidAndSent(books);
      await refunded(raised.payment.id, 3_000, { stripeRefundId: null, source: "group_webhook" });
      await refunded(raised.payment.id, -3_000, {
        source: "refund_reversal",
        stripeRefundId: "re_x",
      });
      await expect(
        projection().project(await refundedEvent(raised.payment.id)),
      ).rejects.toMatchObject({
        retryable: false,
        code: "refund_reversal_unmatched",
      });
      expect(await creditNotesOf(ref("invoice", raised.invoice.id), "test_org")).toEqual([]);
    });

    it("guard: six registrations of different credit notes at once never credit more than the invoice", async () => {
      const books = new InMemoryAccounting();
      const { raised } = await paidAndSent(books);
      const invoiceRow = await rowOf(ref("invoice", raised.invoice.id), "test_org");
      const invoice = invoiceRow.payload as unknown as Invoice;
      // Each credits 70% of the invoice: any two together are too much.
      const notes = Array.from({ length: 6 }, (_, i) => {
        const built = buildCreditNoteFor(invoice, {
          sourceId: `guard-${raised.invoice.id.slice(0, 8)}-${i}`,
          issuedOn: "2031-11-20",
          buckets: {
            paidGoodsPence: invoice.totals.grossPence,
            paidDeliveryPence: 0,
            refundedGoodsPence: 0,
            refundedDeliveryPence: 0,
          },
          request: { goodsPence: Math.floor(invoice.totals.grossPence * 0.7), deliveryPence: 0 },
          priorCredits: [],
        });
        if (!built.ok) throw new Error(built.refusal.message);
        return built.value;
      });
      const outcomes = await Promise.all(
        notes.map((document) =>
          repos.registry.register({ document, sourceEventRef: "test:guard" }),
        ),
      );
      expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
      expect(
        outcomes.filter((o) => !o.ok && o.refusal.code === "credit_exceeds_invoice"),
      ).toHaveLength(5);
      const stored = await creditNotesOf(invoice.reference, "test_org");
      expect(stored.reduce((sum, n) => sum + n.grossPence, 0)).toBeLessThanOrEqual(
        invoice.totals.grossPence,
      );
    });

    it("F8: a credit note is not sent before its invoice, and is parked if the invoice is cancelled", async () => {
      await aimBooks("test_org");
      const books = new InMemoryAccounting();
      const buyer = await seedBuyer(owner);
      const raised = await wonAndRaised(owner, buyer, 10_000, 0);
      await owner
        .update(payment)
        .set({ status: "captured" })
        .where(eq(payment.id, raised.payment.id));
      await projection().project(await capturedEvent(raised));
      const row = await refunded(raised.payment.id, 500);
      await projection().project(await refundedEvent(raised.payment.id));
      const invoiceRef = ref("invoice", raised.invoice.id);
      // The invoice is cancelled in Accounting before anything is sent.
      const invoiceRow = await rowOf(invoiceRef, "test_org");
      expect((await repos.transitions.apply(invoiceRow.id, { action: "cancel" })).ok).toBe(true);
      const issue = vi.spyOn(books.creditNotes, "issueCreditNote");
      await sendAll("test_org", books);
      expect(issue).not.toHaveBeenCalled();
      expect(await rowOf(ref("credit_note", row.id), "test_org")).toMatchObject({
        state: "needs_review",
        needsReviewReason: "accounting_parked_credited_invoice_cancelled",
      });
    });

    it("F9: a Pay several lot is credited at most what it was charged; the courier refund credits the delivery invoice, parked with it", async () => {
      await aimBooks("dry_run");
      const buyer = await seedBuyer(owner);
      const a = await wonAndRaised(owner, buyer, 10_000, 2_500);
      const b = await wonAndRaised(owner, buyer, 5_000, 1_250);
      const { groupId, event, quoteIds } = await settleGroup(buyer, [a, b], [4_500]);
      await projection().project(event);
      // The buyer's record of lot a holds more than it was charged (the rest is unattributed).
      await refunded(a.payment.id, 12_000, { source: "group_webhook", stripeRefundId: null });
      await refunded(a.payment.id, 1_000, { source: "group_webhook", stripeRefundId: null });
      await projection().project(await refundedEvent(a.payment.id));
      const lotNotes = await creditNotesOf(ref("invoice", a.invoice.id), "dry_run");
      expect(lotNotes.reduce((sum, n) => sum + n.grossPence, 0)).toBe(12_500);
      // The courier quote's running total rises twice; each step credits the difference once.
      const quoteId = quoteIds[0] as string;
      const deliveryEvent = async (total: number) => {
        await owner
          .update(paymentGroupDelivery)
          .set({ refundedPence: total })
          .where(eq(paymentGroupDelivery.deliveryQuoteId, quoteId));
        return publish("payment_group.delivery_refunded", groupId, {
          paymentGroupId: groupId,
          deliveryQuoteId: quoteId,
          stripeChargeId: "ch_fixture",
          cumulativeRefundedCents: total,
          chargedCents: 4_500,
          currency: "gbp",
        });
      };
      const first = await deliveryEvent(1_500);
      await Promise.all(Array.from({ length: 4 }, () => projection().project(first)));
      const second = await deliveryEvent(4_000);
      await projection().project(second);
      await projection().project(first);
      const deliveryRef = ref("invoice", `dlv-${quoteId}`);
      const notes = await creditNotesOf(deliveryRef, "dry_run");
      expect(notes.map((n) => n.grossPence).sort((x, y) => x - y)).toEqual([1_500, 2_500]);
      expect(notes.every((n) => n.needsReviewReason === "accounting_parked_vat_on_delivery")).toBe(
        true,
      );
      // Dated the day of the refund (the event's time), refunded from Stripe clearing.
      expect(notes.map((n) => (n.payload as unknown as CreditNote).refund)).toEqual([
        { account: "stripe_clearing", refundedOn: "2031-11-20" },
        { account: "stripe_clearing", refundedOn: "2031-11-20" },
      ]);
      // Above the charge: only up to the charge.
      await projection().project(await deliveryEvent(9_999));
      const capped = await creditNotesOf(deliveryRef, "dry_run");
      expect(capped.reduce((sum, n) => sum + n.grossPence, 0)).toBe(4_500);
    });

    describe("F11: buyer default", () => {
      async function defaulted(books: InMemoryAccounting, send: boolean) {
        await aimBooks("test_org");
        const buyer = await seedBuyer(owner);
        const raised = await wonAndRaised(owner, buyer, 20_000, 5_000);
        await projection().project(
          await publish(
            "invoice.raised",
            raised.invoice.id,
            {
              invoiceId: raised.invoice.id,
              lotId: raised.payment.lotId,
              buyerLegalEntityId: buyer.buyerEntityId,
              totalPence: 25_000,
              raisedAt: RAISED_AT.toISOString(),
            },
            RAISED_AT,
          ),
        );
        if (send) await sendAll("test_org", books);
        await owner
          .update(bidInvoice)
          .set({ voidedAt: new Date("2031-11-30T10:00:00Z") })
          .where(eq(bidInvoice.id, raised.invoice.id));
        const event = await publish("payment.cancelled", raised.payment.id, {
          lotId: raised.payment.lotId,
          buyerUserId: buyer.buyerId,
          reason: "buyer_default",
        });
        return { buyer, raised, event, invoiceRef: ref("invoice", raised.invoice.id) };
      }

      function staff(defaultTreatment: BidDefaultTreatment | null) {
        const apiRepos = createAccountingRepositories(api, { now: () => new Date() });
        return new AccountingQueueService({
          browser: apiRepos.browser,
          partFunded: apiRepos.partFunded,
          transitions: apiRepos.transitions,
          audit: { retryRequested: async () => {}, releaseRequested: async () => {} },
          booksLink: () => null,
          facts: new DrizzleBidAccountingFactsReader(api),
          lookup: apiRepos.lookup,
          releaseBasis: apiRepos.releaseBasis,
          creditNotes: apiRepos.creditNotes,
          defaultTreatment,
        });
      }

      it("an invoice never sent is cancelled in the books, and nothing is made", async () => {
        const books = new InMemoryAccounting();
        const { event, invoiceRef } = await defaulted(books, false);
        expect(await projection().project(event)).toMatchObject({ created: 0, cancelled: 1 });
        expect(await rowOf(invoiceRef, "test_org")).toMatchObject({ state: "cancelled" });
        expect(await creditNotesOf(invoiceRef, "test_org")).toEqual([]);
        // Again: nothing more.
        expect(await projection().project(event)).toMatchObject({ created: 0, cancelled: 0 });
      });

      it("an invoice being sent is decided later (tried again), never guessed", async () => {
        const books = new InMemoryAccounting();
        const { event, invoiceRef } = await defaulted(books, false);
        const invoiceRow = await rowOf(invoiceRef, "test_org");
        await owner.execute(sql`
        update accounting_document set state = 'sending', provider = 'books', lease_token = 'held-elsewhere',
               lease_expires_at = now() + interval '5 minutes', attempts = 1
         where id = ${invoiceRow.id}`);
        await expect(projection().project(event)).rejects.toMatchObject({
          retryable: true,
          code: "invoice_in_flight",
        });
        expect(await creditNotesOf(invoiceRef, "test_org")).toEqual([]);
      });

      it("an issued invoice gets a full credit note, parked and never sent until the treatment is set; Release then moves it on", async () => {
        const books = new InMemoryAccounting();
        const { event, invoiceRef, raised } = await defaulted(books, true);
        expect(await projection().project(event)).toMatchObject({ created: 1, parked: 1 });
        const noteRef = ref("credit_note", `dft-${raised.invoice.id}`);
        const note = await rowOf(noteRef, "test_org");
        const invoiceRow = await rowOf(invoiceRef, "test_org");
        expect(note).toMatchObject({
          state: "needs_review",
          needsReviewReason: "accounting_parked_buyer_default_treatment",
          grossPence: invoiceRow.grossPence,
          netPence: invoiceRow.netPence,
          vatPence: invoiceRow.vatPence,
        });
        expect((note.payload as unknown as CreditNote).refund).toBeUndefined();
        const issue = vi.spyOn(books.creditNotes, "issueCreditNote");
        await sendAll("test_org", books);
        expect(issue).not.toHaveBeenCalled();
        // Unset: refused, nothing changes. 'void': refused, voiding is not built.
        for (const treatment of [null, "void"] as const) {
          const out = await staff(treatment).release({
            documentId: note.id,
            actorUserId: "staff-1",
          });
          expect(out).toMatchObject({ ok: false, refusal: "unresolved" });
          expect(await rowOf(noteRef, "test_org")).toMatchObject({ state: "needs_review" });
        }
        // Decided in the application (a test stands in for the accountant's answer): the database
        // still refuses api_app (0385) until the migration that ships the answer lifts its line.
        const refused = await staff("credit_note")
          .release({ documentId: note.id, actorUserId: "staff-1" })
          .then(
            () => "moved",
            (error: { cause?: { code?: string } }) => error.cause?.code,
          );
        expect(refused).toBe("42501");
        expect(await rowOf(noteRef, "test_org")).toMatchObject({ state: "needs_review" });
        // Once lifted, the release moves it on (the owner stands in for that release), then sent.
        await owner.execute(sql`
          update accounting_document set state = 'pending', review_lookup = null,
                 needs_review_reason = null
           where id = ${note.id}`);
        await sendAll("test_org", books);
        expect(await rowOf(noteRef, "test_org")).toMatchObject({ state: "issued" });
        // No money went back: nothing to refund from clearing.
        await refunder("test_org", books).tick();
        expect(books.creditNoteRefundOf("bid", noteRef)).toBeNull();
      });
    });

    it("flow 10: unassigned Pay several refunds are listed for a person, and make no document", async () => {
      await aimBooks("dry_run");
      const buyer = await seedBuyer(owner);
      const a = await wonAndRaised(owner, buyer, 10_000, 0);
      const { groupId } = await settleGroup(buyer, [a], []);
      await owner
        .update(paymentGroup)
        .set({ refundUnattributedPence: 777 })
        .where(eq(paymentGroup.id, groupId));
      const apiRepos = createAccountingRepositories(api, { now: () => new Date() });
      const listed = await apiRepos.unattributedRefunds.list(500);
      expect(listed.find((u) => u.paymentGroupId === groupId)).toMatchObject({ amountPence: 777 });
      const event = await publish("payment_group.refund_unattributed", groupId, {
        paymentGroupId: groupId,
        stripeChargeId: "ch_fixture",
        amountCents: 777,
        cumulativeUnattributedCents: 777,
        currency: "gbp",
      });
      expect(await projection().project(event)).toEqual({
        outcome: "skipped",
        reason: "not_an_accounting_event",
      });
    });
  },
);
