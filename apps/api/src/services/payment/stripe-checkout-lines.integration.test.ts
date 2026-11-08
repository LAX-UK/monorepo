import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidInvoice, legalEntity, lot, payment, sale } from "@auction/db/schema";
import { InvoiceRaiser } from "@auction/finance-runtime";
import {
  DrizzleBidInvoiceRepository,
  DrizzleLotRepository,
  DrizzleSaleRepository,
} from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { groupStripeLineItems } from "../stripe/stripe-payment-group.gateway.js";
import { loadCheckedInvoiceLines } from "./invoice-stripe-lines.js";
import { buildStripeCheckoutLineItems } from "./stripe-checkout-product-display.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The Stripe lines are built from the invoice rows as stored, and add up to the stored invoice
 * total and to the payment's amount, to the penny, at the premium band edge.
 */
describe.skipIf(!HAS_DB)("Stripe checkout lines from stored invoices (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const invoices = new DrizzleBidInvoiceRepository(db);
  const raiser = new InvoiceRaiser({ invoices, sales: new DrizzleSaleRepository(db) });
  const lots = new DrizzleLotRepository(db);

  const run = randomUUID().slice(0, 8);
  const buyerUserId = `sl-buyer-${run}`;
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const saleId = randomUUID();
  const edgeLots = [
    { id: randomUUID(), hammer: "499999.99", totalPence: 57_499_999 },
    { id: randomUUID(), hammer: "500000.00", totalPence: 55_000_000 },
  ];
  const flatLot = { id: randomUUID(), hammer: "1000.00", totalPence: 125_000 };
  const allLots = [...edgeLots, flatLot];

  beforeAll(async () => {
    const now = new Date();
    await seedIdentityUserFixtures(db, [
      { id: buyerUserId, name: "Buyer", email: `${buyerUserId}@integration.test` },
    ]);
    await db.insert(legalEntity).values([
      {
        id: buyerId,
        displayName: "Buyer",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyerUserId,
        status: "approved",
      },
      {
        id: sellerId,
        displayName: "Seller",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyerUserId,
        status: "approved",
      },
    ]);
    await db.insert(sale).values({
      id: saleId,
      title: "Stripe lines sale",
      status: "active",
      deliveryMode: "online",
      allowOnlineBidsBeforeGoLive: false,
      startTime: new Date(now.getTime() - 3 * 86_400_000),
      endTime: new Date(now.getTime() - 86_400_000),
      buyerPremiumRate: "0.25",
      buyerPremiumTiers: [
        { hammerThresholdMinor: 0, rate: "0.1500" },
        { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
      ],
      createdByLegalEntityId: sellerId,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(lot).values(
      allLots.map((l) => ({
        id: l.id,
        // The flat lot sits outside the tiered sale.
        saleId: l === flatLot ? null : saleId,
        title: `Work ${l.hammer}`,
        images: [],
        auctionType: "english" as const,
        startingPrice: "10.00",
        currentPrice: l.hammer,
        buyerPremiumRate: "0.25",
        minBidIncrement: "10.00",
        startTime: new Date(now.getTime() - 3 * 86_400_000),
        endTime: new Date(now.getTime() - 86_400_000),
        status: "ended" as const,
        sellerLegalEntityId: sellerId,
        winnerId: buyerUserId,
        buyerLegalEntityId: buyerId,
      })),
    );
  });

  afterAll(async () => {
    const ids = allLots.map((l) => l.id);
    await db.delete(payment).where(inArray(payment.lotId, ids));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, ids));
    await db.delete(lot).where(inArray(lot.id, ids));
    await db.delete(sale).where(eq(sale.id, saleId));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerId, sellerId]));
    await deleteIdentityUserFixtures(db, [buyerUserId]);
  });

  async function raise(lotId: string) {
    const found = await lots.findById(lotId);
    if (!found) throw new Error("lot not seeded");
    const priced = await raiser.price(found);
    const raised = await raiser.raise({
      lot: found,
      priced,
      payment: {
        lotId,
        paidByUserId: buyerUserId,
        buyerLegalEntityId: buyerId,
        sellerLegalEntityId: sellerId,
        platformFee: "0.00",
        stripePaymentIntentId: null,
      },
    });
    return { lot: found, ...raised };
  }

  it.each([...edgeLots, flatLot])(
    "a hammer of £$hammer charges the stored lines, which add up to the invoice and the payment",
    async ({ id, totalPence }) => {
      const { lot: raisedLot, invoice, payment: paid } = await raise(id);
      const paymentPence = Math.round(Number(paid.amount) * 100);
      expect(paymentPence).toBe(totalPence);
      expect(invoice.totalPence).toBe(totalPence);

      const stored = await invoices.findByPaymentIds([paid.id]);
      const checked = (
        await loadCheckedInvoiceLines(invoices, [{ paymentId: paid.id, amountPence: paymentPence }])
      ).get(paid.id);
      expect(checked?.lines).toEqual(stored.get(paid.id)?.lines);

      const items = buildStripeCheckoutLineItems({
        paymentId: paid.id,
        lotId: raisedLot.id,
        lotTitle: raisedLot.title,
        lotNumber: raisedLot.lotNumber,
        medium: null,
        amountCents: paymentPence,
        invoiceLines: checked?.lines ?? [],
      });
      expect(items.reduce((sum, item) => sum + item.unitAmountCents, 0)).toBe(totalPence);

      const group = groupStripeLineItems(
        {
          currency: "GBP",
          deliveries: [],
          totalPence,
          lines: [
            {
              paymentId: paid.id,
              lotId: raisedLot.id,
              lotTitle: raisedLot.title,
              lotNumber: raisedLot.lotNumber,
              amountPence: paymentPence,
              invoiceLines: checked?.lines ?? [],
            },
          ],
        },
        {},
      );
      expect(group.reduce((sum, item) => sum + (item.price_data?.unit_amount ?? 0), 0)).toBe(
        totalPence,
      );
    },
  );

  it("refuses a payment that has no invoice", async () => {
    const orphan = randomUUID();
    await expect(
      loadCheckedInvoiceLines(invoices, [{ paymentId: orphan, amountPence: 100 }]),
    ).rejects.toThrow(/no stored invoice/);
  });
});
