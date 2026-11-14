import { randomUUID } from "node:crypto";
import {
  type BidDefaultTreatment,
  type CreditNote,
  type DestinationBinding,
  type Invoice,
  buildCreditNoteFor,
  laxReference,
  projectBidDeliveryRefunded,
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
  paymentCheckoutSession,
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
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { holdAccountingTablesLock } from "../../testing/accounting-tables-lock.js";
import { AccountingCreditNoteRefund } from "./accounting-credit-note-refund.service.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingProjection } from "./accounting-projection.service.js";
import { AccountingSender } from "./accounting-sender.service.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const API_URL = process.env.DATABASE_URL_API;

/** The owner's connection string, its sessions opened as `role` (a superuser may set any role). */
function asRole(url: string, role: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-c role=${role}`);
  return parsed.toString();
}
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
    // As api_app, so its 0385 trigger is exercised: its own URL when configured, otherwise the
    // owner's sessions opened as api_app (the CI test job sets no api_app password).
    const api = createDb(API_URL || asRole(OWNER_URL as string, "api_app"));
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

    describe("after review #1375", () => {
      const alerts = () => ({ raise: vi.fn() });

      /** Projects the event, trying again (as the projector does) while it is refused for now. */
      async function projectSettled(event: Parameters<AccountingProjection["project"]>[0]) {
        for (let attempt = 0; ; attempt += 1) {
          try {
            return await projection().project(event);
          } catch (error) {
            if ((error as { retryable?: boolean }).retryable !== true || attempt >= 20) throw error;
          }
        }
      }

      /** A registry that stops each credit note's registration until `release` (another worker is slow). */
      function slowRegistry() {
        let release!: () => void;
        const gate = new Promise<void>((r) => {
          release = r;
        });
        let reached!: () => void;
        const atRegister = new Promise<void>((r) => {
          reached = r;
        });
        const registry: typeof repos.registry = {
          register: async (input) => {
            if (input.document.kind === "credit_note") {
              reached();
              await gate;
            }
            return repos.registry.register(input);
          },
          awaitCreditRegistrations: (...args) => repos.registry.awaitCreditRegistrations(...args),
        };
        const slow = new AccountingProjection({
          facts: new DrizzleBidAccountingFactsReader(worker),
          settings: repos.settingReader,
          registry,
          books: {
            lookup: repos.lookup,
            creditNotes: repos.creditNotes,
            transitions: repos.transitions,
          },
        });
        return { slow, atRegister, release: () => release() };
      }

      async function courierQuote() {
        await aimBooks("dry_run");
        const buyer = await seedBuyer(owner);
        const a = await wonAndRaised(owner, buyer, 10_000, 2_500);
        const { groupId, event, quoteIds } = await settleGroup(buyer, [a], [4_500]);
        await projection().project(event);
        const quoteId = quoteIds[0] as string;
        const setTotal = (total: number) =>
          owner
            .update(paymentGroupDelivery)
            .set({ refundedPence: total })
            .where(eq(paymentGroupDelivery.deliveryQuoteId, quoteId));
        const raise = async (total: number) => {
          await setTotal(total);
          return publish("payment_group.delivery_refunded", groupId, {
            paymentGroupId: groupId,
            deliveryQuoteId: quoteId,
            stripeChargeId: "ch_fixture",
            cumulativeRefundedCents: total,
            chargedCents: 4_500,
            currency: "gbp",
          });
        };
        const lower = async (from: number, to: number) => {
          await setTotal(to);
          return publish("payment_group.refund_reversed", groupId, {
            paymentGroupId: groupId,
            stripeChargeId: "ch_fixture",
            deliveryQuoteId: quoteId,
            amountCents: from - to,
            previousCents: from,
            correctedCents: to,
            currency: "GBP",
            via: "refund_repair",
          });
        };
        const live = async () =>
          (await creditNotesOf(ref("invoice", `dlv-${quoteId}`), "dry_run")).filter(
            (n) => n.state !== "cancelled",
          );
        return { quoteId, raise, lower, live };
      }

      it("RV1: two courier-refund projections that interleave credit exactly what was refunded", async () => {
        const { raise, live } = await courierQuote();
        const first = await raise(1_500);
        // P1 reads its facts (total 1,500, no credit yet), then is slow to register.
        const { slow, atRegister, release } = slowRegistry();
        const p1 = slow.project(first).then(
          () => "registered",
          (error: { code?: string; retryable?: boolean }) => error,
        );
        await atRegister;
        // The second refund lands and is projected in full meanwhile (another worker).
        const second = await raise(3_000);
        await projection().project(second);
        release();
        // P1's note was built on a credit that has changed: refused for now, never registered.
        expect(await p1).toMatchObject({ code: "credit_prior_changed", retryable: true });
        // Tried again from fresh facts: nothing more to credit.
        expect(await projectSettled(first)).toMatchObject({ created: 0 });
        const notes = await live();
        expect(notes.map((n) => n.grossPence)).toEqual([3_000]);
      });

      it("RV1: many courier-refund projections on separate connections never credit more than the refunded total", async () => {
        const { raise, live } = await courierQuote();
        const events = [];
        for (const total of [1_000, 2_000, 3_500, 4_500]) events.push(await raise(total));
        // Every event three times, all at once, each retried as the projector would.
        await Promise.all(events.flatMap((event) => [1, 2, 3].map(() => projectSettled(event))));
        const notes = await live();
        expect(notes.reduce((sum, n) => sum + n.grossPence, 0)).toBe(4_500);
      });

      it("RV1: a total raised while a projection was slow: the note is built from the total as it stands when registered", async () => {
        const { raise, live } = await courierQuote();
        const first = await raise(1_500);
        const { slow, atRegister, release } = slowRegistry();
        const p1 = slow.project(first).then(
          () => "registered",
          (error: { code?: string }) => error,
        );
        await atRegister;
        // The total rises before P1 registers; its own event is not projected yet.
        await raise(3_000);
        release();
        expect(await p1).toMatchObject({ code: "credit_prior_changed" });
        expect(await projectSettled(first)).toMatchObject({ created: 1 });
        expect((await live()).map((n) => n.grossPence)).toEqual([3_000]);
      });

      it("RV1: a credit note cancelled while a projection was slow: the next note is built after what stands now", async () => {
        const { raise, live } = await courierQuote();
        await projection().project(await raise(1_500));
        const [earlier] = await live();
        const second = await raise(3_000);
        const { slow, atRegister, release } = slowRegistry();
        const p1 = slow.project(second).then(
          () => "registered",
          (error: { code?: string }) => error,
        );
        await atRegister;
        // A person cancels the earlier credit note meanwhile (it was never sent).
        expect(
          await repos.transitions.apply(earlier?.id as string, { action: "cancel" }),
        ).toMatchObject({
          ok: true,
        });
        release();
        expect(await p1).toMatchObject({ code: "credit_prior_changed" });
        await projectSettled(second);
        expect((await live()).map((n) => n.grossPence)).toEqual([3_000]);
      });

      it("RV1: the registry never lets a courier refund's credit notes pass its refunded total, whatever basis it is given", async () => {
        const { quoteId, raise, live } = await courierQuote();
        await raise(1_500);
        const [delivery] = await owner
          .select()
          .from(paymentGroupDelivery)
          .where(eq(paymentGroupDelivery.deliveryQuoteId, quoteId));
        // A note for 3,000 against a stored total of 1,500, with a basis that matches the rows.
        const facts = await new DrizzleBidAccountingFactsReader(worker).deliveryRefunded(
          delivery?.paymentGroupId as string,
          quoteId,
          REFUNDED_AT,
        );
        if (facts.status !== "ready") throw new Error("no facts");
        const built = projectBidDeliveryRefunded({ ...facts.facts, refundedPence: 3_000 });
        if (!built.ok) throw new Error(built.refusal.message);
        for (const document of built.value.documents.filter((d) => d.kind !== "credit_note")) {
          await repos.registry.register({ document, sourceEventRef: "test:ceiling" });
        }
        const note = built.value.documents.find((d) => d.kind === "credit_note");
        if (!note) throw new Error("no note");
        const out = await repos.registry.register({
          document: note,
          sourceEventRef: "test:ceiling",
          park: "vat_on_delivery",
          creditBasis: {
            kind: "delivery_refund",
            groupId: delivery?.paymentGroupId as string,
            quoteId,
            refundedPence: 1_500,
            priorCreditPence: 0,
          },
        });
        expect(out).toMatchObject({ ok: false, refusal: { code: "credit_exceeds_refunded" } });
        expect(await live()).toEqual([]);
      });

      it("RV2: a refund credit note stored by the earlier refund flow (no `refund`) is that refund's; the next refund is credited after it", async () => {
        const books = new InMemoryAccounting();
        const { raised } = await paidAndSent(books);
        const first = await refunded(raised.payment.id, 2_000);
        await projection().project(await refundedEvent(raised.payment.id));
        // The stored note as the earlier flow stored it: the same reference, no `refund`.
        const noteRef = ref("credit_note", first.id);
        await owner.execute(sql`
          update accounting_document set payload = payload - 'refund'
           where lax_reference = ${noteRef} and target_mode = 'test_org'`);
        const second = await refunded(raised.payment.id, 1_000);
        expect(await projection().project(await refundedEvent(raised.payment.id))).toMatchObject({
          outcome: "projected",
          created: 1,
        });
        expect(await rowOf(ref("credit_note", second.id), "test_org")).toMatchObject({
          grossPence: 1_000,
        });
        expect((await rowOf(noteRef, "test_org")).payload).not.toHaveProperty("refund");
      });

      it("RV3: api_app cannot move a parked buyer-default credit note to pending (the treatment is unset)", async () => {
        const books = new InMemoryAccounting();
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
        await sendAll("test_org", books);
        await owner
          .update(bidInvoice)
          .set({ voidedAt: new Date("2031-11-30T10:00:00Z") })
          .where(eq(bidInvoice.id, raised.invoice.id));
        await projection().project(
          await publish("payment.cancelled", raised.payment.id, {
            lotId: raised.payment.lotId,
            buyerUserId: buyer.buyerId,
            reason: "buyer_default",
          }),
        );
        const note = await rowOf(ref("credit_note", `dft-${raised.invoice.id}`), "test_org");
        expect(note.needsReviewReason).toBe("accounting_parked_buyer_default_treatment");
        const moved = await api
          .execute(sql`
            update accounting_document
               set state = 'pending', review_lookup = null, needs_review_reason = null
             where id = ${note.id}`)
          .then(
            () => "moved",
            (error: { cause?: { code?: string } }) => error.cause?.code,
          );
        expect(moved).toBe("42501");
        expect(await rowOf(note.laxReference, "test_org")).toMatchObject({ state: "needs_review" });
      });

      const reversalOf = async (paymentId: string, counted: typeof paymentRefund.$inferSelect) => {
        await refunded(paymentId, -counted.amountPence, {
          source: "refund_reversal",
          stripeRefundId: counted.stripeRefundId,
        });
        return publish("payment.refund_reversed", paymentId, {
          stripeChargeId: "ch_fixture",
          amountCents: counted.amountPence,
          sellerAmountCents: 0,
          cumulativeRefundedCents: 0,
          currency: "gbp",
          sellerLegalEntityId: null,
          via: "stripe_webhook",
        });
      };

      it("F2: a refund taken back before its credit note was sent cancels that note; the refunds that stayed keep theirs", async () => {
        const books = new InMemoryAccounting();
        const { raised } = await paidAndSent(books);
        const a = await refunded(raised.payment.id, 2_000);
        const b = await refunded(raised.payment.id, 1_000);
        await projection().project(await refundedEvent(raised.payment.id));
        const before = await rowOf(ref("credit_note", b.id), "test_org");
        const reversed = await reversalOf(raised.payment.id, a);
        expect(await projection().project(reversed)).toMatchObject({ cancelled: 1 });
        expect(await rowOf(ref("credit_note", a.id), "test_org")).toMatchObject({
          state: "cancelled",
        });
        // Again: nothing more.
        expect(await projection().project(reversed)).toMatchObject({ cancelled: 0 });
        // A later refund: the one that stayed is a replay, exactly as stored.
        const c = await refunded(raised.payment.id, 500);
        expect(await projection().project(await refundedEvent(raised.payment.id))).toMatchObject({
          created: 1,
        });
        expect((await rowOf(ref("credit_note", b.id), "test_org")).payload).toEqual(before.payload);
        await sendAll("test_org", books);
        await refunder("test_org", books).tick();
        expect(books.creditNoteRefundOf("bid", ref("credit_note", a.id))).toBeNull();
        expect(books.creditNoteRefundOf("bid", ref("credit_note", b.id))).toBe(1_000);
        expect(books.creditNoteRefundOf("bid", ref("credit_note", c.id))).toBe(500);
      });

      it("F2: a refund taken back after its credit note was issued holds the note for a person and alerts; it is never refunded from clearing", async () => {
        const books = new InMemoryAccounting();
        const { raised } = await paidAndSent(books);
        const a = await refunded(raised.payment.id, 2_000);
        await projection().project(await refundedEvent(raised.payment.id));
        await sendAll("test_org", books);
        const noteRef = ref("credit_note", a.id);
        const issued = await rowOf(noteRef, "test_org");
        expect(issued).toMatchObject({ state: "issued" });
        const sink = alerts();
        const withAlerts = new AccountingProjection({
          facts: new DrizzleBidAccountingFactsReader(worker),
          settings: repos.settingReader,
          registry: repos.registry,
          books: {
            lookup: repos.lookup,
            creditNotes: repos.creditNotes,
            transitions: repos.transitions,
          },
          alerts: sink as never,
        });
        const reversed = await reversalOf(raised.payment.id, a);
        expect(await withAlerts.project(reversed)).toMatchObject({ held: 1, cancelled: 0 });
        expect(await rowOf(noteRef, "test_org")).toMatchObject({
          state: "needs_review",
          reviewLookup: "clear",
          needsReviewReason: "accounting_refund_reversed_after_credit",
          providerId: issued.providerId,
        });
        expect(sink.raise).toHaveBeenCalledTimes(1);
        expect(sink.raise.mock.calls[0]?.[0]).toMatchObject({
          message: "accounting_refund_reversed_after_credit",
          level: "error",
        });
        expect(sink.raise.mock.calls[0]?.[1]).toMatchObject({ reference: noteRef });
        // Never refunded from clearing from now on.
        expect((await refunder("test_org", books).tick()).refunded).toBe(0);
        expect(books.creditNoteRefundOf("bid", noteRef)).toBeNull();
        // Again: already with a person, nothing more and no second alert.
        expect(await withAlerts.project(reversed)).not.toHaveProperty("held");
        expect(sink.raise).toHaveBeenCalledTimes(1);
        // On the Accounting page: Needs a person.
        const apiRepos = createAccountingRepositories(api, { now: () => new Date() });
        const attention = await apiRepos.attention.read([]);
        expect(attention.needsPerson.count).toBeGreaterThan(0);
      });

      it("F2: a projection that read a refund before it was taken back never registers its credit note", async () => {
        const books = new InMemoryAccounting();
        const { raised } = await paidAndSent(books);
        const a = await refunded(raised.payment.id, 2_000);
        const event = await refundedEvent(raised.payment.id);
        const { slow, atRegister, release } = slowRegistry();
        const p1 = slow.project(event).then(
          () => "registered",
          (error: { code?: string }) => error,
        );
        await atRegister;
        const reversed = await reversalOf(raised.payment.id, a);
        // The reversal waits for no registration that has not started its check yet.
        expect(await projection().project(reversed)).toMatchObject({ cancelled: 0 });
        release();
        expect(await p1).toMatchObject({ code: "credit_prior_changed" });
        expect(await projection().project(event)).toEqual({
          outcome: "skipped",
          reason: "no_refund_recorded",
        });
        expect(await creditNotesOf(ref("invoice", raised.invoice.id), "test_org")).toEqual([]);
      });

      it("F2: a reversal while a credit note's registration is mid-transaction waits for it, then cancels the note", async () => {
        const books = new InMemoryAccounting();
        const { raised } = await paidAndSent(books);
        const a = await refunded(raised.payment.id, 2_000);
        // Hold the history table so the registration stops inside its transaction, after its
        // checks and with the invoice's credit lock held (another worker, mid-commit).
        const blocker = new Client({ connectionString: OWNER_URL });
        await blocker.connect();
        try {
          await blocker.query("begin");
          await blocker.query("lock table accounting_document_event in exclusive mode");
          const p1 = projection().project(await refundedEvent(raised.payment.id));
          for (let i = 0; i < 100; i += 1) {
            const waiting = await blocker.query(
              `select 1 from pg_stat_activity
                where wait_event_type = 'Lock' and query ilike 'insert into "accounting_document_event"%'`,
            );
            if (waiting.rowCount) break;
            await new Promise((r) => setTimeout(r, 50));
          }
          const reversed = await reversalOf(raised.payment.id, a);
          const h = projection().project(reversed);
          await new Promise((r) => setTimeout(r, 300));
          await blocker.query("commit");
          await p1;
          expect(await h).toMatchObject({ cancelled: 1 });
        } finally {
          await blocker.end();
        }
        expect(await rowOf(ref("credit_note", a.id), "test_org")).toMatchObject({
          state: "cancelled",
        });
      });

      it("F2: a courier refund lowered after its credit note was made: the note never sent is cancelled and the credit rebuilt to the new total", async () => {
        const { raise, lower, live } = await courierQuote();
        await projection().project(await raise(3_000));
        expect((await live()).map((n) => n.grossPence)).toEqual([3_000]);
        expect(await projection().project(await lower(3_000, 1_500))).toMatchObject({
          cancelled: 1,
          created: 1,
        });
        expect((await live()).map((n) => n.grossPence)).toEqual([1_500]);
        // A later rise is credited after what stands now: 2,500 refunded, 2,500 credited.
        await projection().project(await raise(2_500));
        const notes = await live();
        expect(notes.map((n) => n.grossPence).sort((x, y) => x - y)).toEqual([1_000, 1_500]);
        expect(
          notes.every((n) => n.needsReviewReason === "accounting_parked_vat_on_delivery"),
        ).toBe(true);
      });

      it("F8: the buyer card says how the invoice was paid (Pay several by its rail; one payment only when its sessions agree)", async () => {
        const books = new InMemoryAccounting();
        const { raised } = await paidAndSent(books);
        const apiRepos = createAccountingRepositories(api, { now: () => new Date() });
        const paidWith = async (invoiceId: string) => {
          const read = await apiRepos.bidInvoiceBooks.read(invoiceId);
          if (!read.ok || !read.value) throw new Error("unreadable");
          return read.value.paidWith;
        };
        expect(await paidWith(raised.invoice.id)).toBeNull();
        const session = (rail: string) =>
          owner.insert(paymentCheckoutSession).values({
            stripeSessionId: `cs_fixture_${randomUUID()}`,
            paymentId: raised.payment.id,
            rail,
          });
        await session("bank");
        expect(await paidWith(raised.invoice.id)).toBe("bank_transfer");
        await session("card");
        // Two rails tried: not known for certain, so nothing is said.
        expect(await paidWith(raised.invoice.id)).toBeNull();
        const buyer = await seedBuyer(owner);
        const lot = await wonAndRaised(owner, buyer, 10_000, 0);
        await settleGroup(buyer, [lot], []);
        expect(await paidWith(lot.invoice.id)).toBe("card");
      });

      it("F5: a credit note Books refuses to refund from clearing is held for a person and alerts, never counted as settled", async () => {
        const books = new InMemoryAccounting();
        const { raised } = await paidAndSent(books);
        const a = await refunded(raised.payment.id, 2_000);
        await projection().project(await refundedEvent(raised.payment.id));
        await sendAll("test_org", books);
        const noteRef = ref("credit_note", a.id);
        const sink = alerts();
        const refusing = new AccountingCreditNoteRefund({
          refunds: repos.creditNoteRefunds,
          settings: repos.settingReader,
          portsByMode: {
            test_org: {
              refundCreditNote: async () => ({
                status: "rejected",
                reason: "zoho_books_credit_note_refund_differs",
              }),
            },
          },
          log,
          alerts: sink as never,
        });
        expect(await refusing.tick()).toMatchObject({ refused: 1 });
        expect(await rowOf(noteRef, "test_org")).toMatchObject({
          state: "needs_review",
          needsReviewReason: "accounting_credit_note_refund_refused",
        });
        expect(sink.raise).toHaveBeenCalledWith(
          expect.objectContaining({ message: "accounting_credit_note_refund_refused" }),
          expect.objectContaining({ reference: noteRef }),
        );
        // Not tried again by itself, and listed for a person.
        expect(await refusing.tick()).toMatchObject({ refused: 0, refunded: 0 });
        const apiRepos = createAccountingRepositories(api, { now: () => new Date() });
        expect((await apiRepos.attention.read([])).needsPerson.count).toBeGreaterThan(0);
      });
    });
  },
);
