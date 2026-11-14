import { randomUUID } from "node:crypto";
import {
  type BidInvoiceFacts,
  projectBidInvoiceRaised,
  projectBidPaymentCaptured,
  projectBidPaymentRefunded,
} from "@auction/accounting-domain";
import { type Database, closeDb, createDb } from "@auction/db";
import {
  bidInvoice,
  bidInvoiceLine,
  bidUserProfile,
  domainEvent,
  legalEntity,
  legalEntityInvoiceDetails,
  lot,
  payment,
  paymentRefund,
  user,
} from "@auction/db/schema";
import { SELLER_RULE_VERSION } from "@auction/domain";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleBidInvoiceRepository } from "../drizzle-bid-invoice.repository.js";
import { DrizzleBidAccountingFactsReader } from "./drizzle-bid-accounting-facts.reader.js";

const OWNER_URL = process.env.DATABASE_URL;
const HAS_DB = Boolean(OWNER_URL);

/** 23:30 on 12 November in London is still the 12th; in UTC it is the same instant. */
const RAISED_AT = new Date("2031-11-12T23:30:00Z");
const DUE_AT = new Date("2031-11-26T23:59:59Z");

class Rollback extends Error {}

/** Runs `work` in a transaction that is always rolled back, so nothing is left behind. */
async function inRolledBack(db: Database, work: (tx: Database) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await work(tx as unknown as Database);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/** A buyer organisation (with a billing email) that has won one lot. */
async function seedWonLot(tx: Database) {
  const tag = randomUUID().slice(0, 8);
  const buyerId = `books-facts-${tag}`;
  const sellerEntityId = randomUUID();
  const buyerEntityId = randomUUID();
  const lotId = randomUUID();
  await tx.insert(user).values({
    id: buyerId,
    name: buyerId,
    email: `${buyerId}@integration.test`,
    emailVerified: true,
    createdAt: RAISED_AT,
    updatedAt: RAISED_AT,
  });
  await tx
    .insert(bidUserProfile)
    .values({ userId: buyerId, createdAt: RAISED_AT, updatedAt: RAISED_AT });
  await tx.insert(legalEntity).values(
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
  await tx
    .insert(legalEntityInvoiceDetails)
    .values({ legalEntityId: buyerEntityId, billingEmail: `accounts-${tag}@integration.test` });
  await tx.insert(lot).values({
    id: lotId,
    sellerLegalEntityId: sellerEntityId,
    title: `Books facts lot ${tag}`,
    images: [],
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: "1234.56",
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

async function raise(
  tx: Database,
  seeded: Awaited<ReturnType<typeof seedWonLot>>,
  amounts: { hammerPence: number; premiumPence: number } = {
    hammerPence: 123_456,
    premiumPence: 30_864,
  },
) {
  const repo = new DrizzleBidInvoiceRepository(tx);
  return repo.raise({
    invoice: {
      lotId: seeded.lotId,
      buyerLegalEntityId: seeded.buyerEntityId,
      sellerLegalEntityId: seeded.sellerEntityId,
      totalPence: amounts.hammerPence + amounts.premiumPence,
      raisedAt: RAISED_AT,
      dueAt: DUE_AT,
      pricingPolicyId: null,
      lines: [
        {
          kind: "hammer",
          label: "Hammer price",
          ratePercent: null,
          amountPence: amounts.hammerPence,
        },
        {
          kind: "buyers_premium",
          label: "Buyer's premium (25%)",
          ratePercent: "25",
          amountPence: amounts.premiumPence,
        },
      ],
    },
    winnerId: seeded.buyerId,
    payment: {
      lotId: seeded.lotId,
      paidByUserId: seeded.buyerId,
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
      hammerPence: amounts.hammerPence,
      premiumPence: amounts.premiumPence,
      ruleVersion: SELLER_RULE_VERSION,
    },
  });
}

describe.skipIf(!HAS_DB)("Bid accounting facts (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  afterAll(async () => {
    await closeDb(owner);
  });

  it("raising an invoice writes invoice.raised in the same transaction, ids only", async () => {
    await inRolledBack(owner, async (tx) => {
      const seeded = await seedWonLot(tx);
      const raised = await raise(tx, seeded);
      const events = await tx
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.eventType, "invoice.raised"),
            eq(domainEvent.aggregateId, raised.invoice.id),
          ),
        );
      expect(events).toHaveLength(1);
      const lineIds = (
        await tx
          .select({ id: bidInvoiceLine.id })
          .from(bidInvoiceLine)
          .where(eq(bidInvoiceLine.invoiceId, raised.invoice.id))
          .orderBy(bidInvoiceLine.position)
      ).map((line) => line.id);
      expect(lineIds).toHaveLength(2);
      expect(events[0]?.payload).toEqual({
        invoiceId: raised.invoice.id,
        lotId: seeded.lotId,
        buyerLegalEntityId: seeded.buyerEntityId,
        totalPence: 154_320,
        raisedAt: RAISED_AT.toISOString(),
        // The frozen lines, by reference only.
        lineIds,
      });
      // A retry after the payment expired joins the invoice and says nothing new.
      await tx
        .update(payment)
        .set({ status: "cancelled" })
        .where(eq(payment.id, raised.payment.id));
      const retried = await raise(tx, seeded);
      expect(retried.invoice.id).toBe(raised.invoice.id);
      expect(retried.invoiceCreated).toBe(false);
      const again = await tx
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.eventType, "invoice.raised"),
            eq(domainEvent.aggregateId, raised.invoice.id),
          ),
        );
      expect(again).toHaveLength(1);
    });
  });

  it("a Bid invoice of 0p cannot be raised, so no invoice.raised event of 0p is ever written", async () => {
    // The invoice.raised schema asks for a positive total because the invoice table does too
    // (bid_invoice_total_check): a fully discounted invoice is refused before any event exists.
    await inRolledBack(owner, async (tx) => {
      const seeded = await seedWonLot(tx);
      const refused = await tx
        .transaction(async (savepoint) => {
          await raise(savepoint as unknown as Database, seeded, {
            hammerPence: 0,
            premiumPence: 0,
          });
        })
        .then(
          () => null,
          (error: unknown) => error as { cause?: { constraint?: string }; constraint?: string },
        );
      expect(refused?.cause?.constraint ?? refused?.constraint).toBe("bid_invoice_total_check");
      const invoices = await tx.select().from(bidInvoice).where(eq(bidInvoice.lotId, seeded.lotId));
      expect(invoices).toHaveLength(0);
      const events = await tx
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.eventType, "invoice.raised"),
            sql`${domainEvent.payload}->>'lotId' = ${seeded.lotId}`,
          ),
        );
      expect(events).toHaveLength(0);
    });
  });

  it("reads the invoice, payment and refunds in pence and London days, and the policies book them", async () => {
    await inRolledBack(owner, async (tx) => {
      const seeded = await seedWonLot(tx);
      const raised = await raise(tx, seeded);
      const reader = new DrizzleBidAccountingFactsReader(tx);

      const invoice = await reader.invoiceRaised(raised.invoice.id);
      const expected: BidInvoiceFacts = {
        invoiceId: raised.invoice.id,
        buyer: {
          legalEntityId: seeded.buyerEntityId,
          name: `Collector Ltd ${seeded.tag}`,
          email: `accounts-${seeded.tag}@integration.test`,
        },
        raisedOn: "2031-11-12",
        dueOn: "2031-11-26",
        // Each line carries its stored id, so the projector can check the event's lineIds.
        lines: [
          { id: expect.any(String), kind: "hammer", label: "Hammer price", amountPence: 123_456 },
          {
            id: expect.any(String),
            kind: "buyers_premium",
            label: "Buyer's premium (25%)",
            amountPence: 30_864,
          },
        ],
      };
      expect(invoice).toEqual({ status: "ready", facts: expected });

      const captured = await reader.paymentCaptured(
        raised.payment.id,
        new Date("2031-11-13T00:30:00Z"),
      );
      expect(captured).toEqual({
        status: "ready",
        facts: {
          paymentId: raised.payment.id,
          invoice: expected,
          amountPence: 154_320,
          capturedOn: "2031-11-13",
        },
      });

      expect(await reader.paymentRefunded(raised.payment.id)).toEqual({
        status: "skip",
        reason: "no_refund_recorded",
      });
      const refundIds = [randomUUID(), randomUUID()];
      await tx.insert(paymentRefund).values([
        {
          id: refundIds[0],
          paymentId: raised.payment.id,
          idempotencyKey: `facts-${refundIds[0]}`,
          amountPence: 1_001,
          currency: "GBP",
          source: "staff",
          createdAt: new Date("2031-11-20T10:00:00Z"),
        },
        {
          id: refundIds[1],
          paymentId: raised.payment.id,
          idempotencyKey: `facts-${refundIds[1]}`,
          amountPence: 50_000,
          currency: "GBP",
          source: "staff",
          createdAt: new Date("2031-11-21T10:00:00Z"),
        },
      ]);
      const refunded = await reader.paymentRefunded(raised.payment.id);
      expect(refunded).toEqual({
        status: "ready",
        facts: {
          invoice: expected,
          paidPence: 154_320,
          refunds: [
            { refundId: refundIds[0], amountPence: 1_001, refundedOn: "2031-11-20" },
            { refundId: refundIds[1], amountPence: 50_000, refundedOn: "2031-11-21" },
          ],
        },
      });

      // The facts project cleanly through each policy, to the penny.
      if (invoice.status !== "ready" || captured.status !== "ready") throw new Error("not ready");
      if (refunded.status !== "ready") throw new Error("not ready");
      expect(projectBidInvoiceRaised(invoice.facts).ok).toBe(true);
      const paid = projectBidPaymentCaptured(captured.facts);
      expect(paid.ok && paid.value.documents[2]).toMatchObject({ amountPence: 154_320 });
      const credited = projectBidPaymentRefunded(refunded.facts);
      expect(credited.ok && credited.value.documents.length).toBe(4);
    });
  });

  it("gives nothing for a voided invoice, a group payment or an unknown id", async () => {
    await inRolledBack(owner, async (tx) => {
      const seeded = await seedWonLot(tx);
      const raised = await raise(tx, seeded);
      const reader = new DrizzleBidAccountingFactsReader(tx);
      expect(await reader.invoiceRaised(randomUUID())).toEqual({
        status: "skip",
        reason: "invoice_not_found",
      });
      expect(await reader.paymentCaptured(randomUUID(), RAISED_AT)).toEqual({
        status: "skip",
        reason: "payment_not_found",
      });
      await tx
        .update(bidInvoice)
        .set({ voidedAt: RAISED_AT })
        .where(eq(bidInvoice.id, raised.invoice.id));
      expect(await reader.invoiceRaised(raised.invoice.id)).toEqual({
        status: "skip",
        reason: "invoice_voided",
      });
      await tx.update(payment).set({ invoiceId: null }).where(eq(payment.id, raised.payment.id));
      expect(await reader.paymentRefunded(raised.payment.id)).toEqual({
        status: "skip",
        reason: "payment_without_invoice",
      });
    });
  });
});
