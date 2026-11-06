import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidInvoice, bidInvoiceLine, legalEntity, lot, payment } from "@auction/db/schema";
import { parsePaymentTierLimits } from "@auction/domain";
import {
  InvoiceRaiser,
  LotInvoiceInitiationService,
  PaymentTierPolicy,
  isOpenPaymentUniqueViolation,
} from "@auction/finance-runtime";
import {
  DrizzleBidInvoiceRepository,
  DrizzleLotRepository,
  DrizzlePaymentRepository,
} from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { createPaymentRecordForWinner } from "./create-pending-for-winner.pipeline.js";
import type { PaymentServiceDeps } from "./payment-service-types.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Invoices are raised from two places, the lot-end job and checkout, and a buyer can double click.
 * These run against a real database with real concurrency: they are the proof that the unique
 * indexes, not luck, keep one invoice, one payment and one set of lines.
 */
describe.skipIf(!HAS_DB)("raising an invoice (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const invoices = new DrizzleBidInvoiceRepository(db);
  const payments = new DrizzlePaymentRepository(db);
  const lots = new DrizzleLotRepository(db);
  const raiser = new InvoiceRaiser({ invoices, sales: null });

  const day = 86_400_000;
  const buyerId = `raise-buyer-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lotIds: string[] = [];

  async function newLot(currentPrice = "1000.00"): Promise<Lot> {
    const id = randomUUID();
    lotIds.push(id);
    await db.insert(lot).values({
      id,
      title: `Raise ${id.slice(0, 6)}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice,
      minBidIncrement: "10.00",
      startTime: new Date(Date.now() - 10 * day),
      endTime: new Date(Date.now() - 2 * day),
      status: "ended",
      sellerLegalEntityId: sellerEntity,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntity,
    });
    const found = await lots.findById(id);
    if (!found) throw new Error("lot was not stored");
    return found;
  }

  const paymentRow = (l: Lot) => ({
    lotId: l.id,
    paidByUserId: buyerId,
    buyerLegalEntityId: buyerEntity,
    sellerLegalEntityId: sellerEntity,
    platformFee: "62.50",
    stripePaymentIntentId: null,
  });

  async function stored(lotId: string) {
    const invoiceRows = await db.select().from(bidInvoice).where(eq(bidInvoice.lotId, lotId));
    const paymentRows = await db.select().from(payment).where(eq(payment.lotId, lotId));
    const lineRows = invoiceRows.length
      ? await db
          .select()
          .from(bidInvoiceLine)
          .where(
            inArray(
              bidInvoiceLine.invoiceId,
              invoiceRows.map((i) => i.id),
            ),
          )
      : [];
    return { invoiceRows, paymentRows, lineRows };
  }

  beforeAll(async () => {
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: buyerId, email: `${buyerId}@integration.test` },
    ]);
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Entity ${id.slice(0, 4)}`,
        kind,
        subkind,
        createdByUserId: buyerId,
        status: "approved",
      });
    }
  });

  afterAll(async () => {
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntity, sellerEntity]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  it("stores the invoice, its lines and the payment together, and they add up", async () => {
    const l = await newLot("1000.00");
    const priced = await raiser.price(l);
    const raised = await raiser.raise({ lot: l, priced, payment: paymentRow(l) });

    const { invoiceRows, paymentRows, lineRows } = await stored(l.id);
    expect(invoiceRows).toHaveLength(1);
    expect(paymentRows).toHaveLength(1);
    expect(raised.invoiceCreated).toBe(true);
    expect(paymentRows[0]?.invoiceId).toBe(invoiceRows[0]?.id);

    const total = Number(invoiceRows[0]?.totalPence);
    expect(total).toBe(125_000);
    expect(lineRows.reduce((sum, line) => sum + Number(line.amountPence), 0)).toBe(total);
    expect(Math.round(Number(paymentRows[0]?.amount) * 100)).toBe(total);
    expect(
      lineRows
        .sort((a, b) => a.position - b.position)
        .map((line) => [line.position, line.kind, Number(line.amountPence)]),
    ).toEqual([
      [1, "hammer", 100_000],
      [2, "buyers_premium", 25_000],
    ]);
  });

  it("a retry after the payment expired keeps the invoice, its figures and its due date", async () => {
    const l = await newLot("1000.00");
    const first = await new InvoiceRaiser({
      invoices,
      sales: null,
      now: () => new Date("2026-06-01T10:00:00Z"),
    }).raise({ lot: l, priced: await raiser.price(l), payment: paymentRow(l) });
    expect(first.invoice.dueAt.toISOString()).toBe("2026-06-08T22:59:59.999Z");

    // The payment expires, and the lot's price is edited afterwards.
    await payments.updateStatus(first.payment.id, "cancelled");
    await db.update(lot).set({ currentPrice: "9999.00" }).where(eq(lot.id, l.id));
    const edited = (await lots.findById(l.id)) as Lot;
    expect(edited.currentPrice).toBe("9999.00");

    const later = new InvoiceRaiser({
      invoices,
      sales: null,
      now: () => new Date("2026-06-20T10:00:00Z"),
    });
    const priced = await later.price(edited);
    expect(priced.totalPence).toBe(125_000);
    expect(priced.existing?.id).toBe(first.invoice.id);
    const retry = await later.raise({ lot: edited, priced, payment: paymentRow(edited) });

    expect(retry.invoiceCreated).toBe(false);
    expect(retry.invoice.id).toBe(first.invoice.id);
    expect(retry.invoice.dueAt.toISOString()).toBe("2026-06-08T22:59:59.999Z");
    expect(retry.payment.id).not.toBe(first.payment.id);
    expect(retry.payment.amount).toBe("1250.00");

    const { invoiceRows, paymentRows, lineRows } = await stored(l.id);
    expect(invoiceRows).toHaveLength(1);
    expect(lineRows).toHaveLength(2);
    expect(paymentRows.map((p) => p.invoiceId)).toEqual([first.invoice.id, first.invoice.id]);
    expect(Number(invoiceRows[0]?.totalPence)).toBe(125_000);
  });

  it("refuses to raise a payment that disagrees with the live invoice", async () => {
    const l = await newLot("1000.00");
    const priced = await raiser.price(l);
    const first = await raiser.raise({ lot: l, priced, payment: paymentRow(l) });
    await payments.updateStatus(first.payment.id, "cancelled");

    await expect(
      raiser.raise({
        lot: l,
        priced: {
          lines: [
            { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 99_900 },
          ],
          totalPence: 99_900,
          policyId: null,
          existing: null,
        },
        payment: paymentRow(l),
      }),
    ).rejects.toThrow(/totals 125000 pence/);

    const { paymentRows } = await stored(l.id);
    expect(paymentRows).toHaveLength(1);
  });

  it("two first requests at once raise one invoice, one payment and one set of lines", async () => {
    const l = await newLot("2500.00");
    const [a, b] = await Promise.all([raiser.price(l), raiser.price(l)]);
    const outcomes = await Promise.allSettled([
      raiser.raise({ lot: l, priced: a, payment: paymentRow(l) }),
      raiser.raise({ lot: l, priced: b, payment: paymentRow(l) }),
    ]);

    const won = outcomes.filter((o) => o.status === "fulfilled");
    const lost = outcomes.filter((o) => o.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    // The loser fails on the open-payment index, which every caller already joins on: never a 500.
    expect(isOpenPaymentUniqueViolation((lost[0] as PromiseRejectedResult).reason)).toBe(true);

    const { invoiceRows, paymentRows, lineRows } = await stored(l.id);
    expect(invoiceRows).toHaveLength(1);
    expect(paymentRows).toHaveLength(1);
    expect(lineRows).toHaveLength(2);
    expect(lineRows.reduce((sum, line) => sum + Number(line.amountPence), 0)).toBe(312_500);
  });

  it("the lot-end job and checkout at once raise one invoice and agree on the payment", async () => {
    const l = await newLot("4000.00");
    const lotEnd = new LotInvoiceInitiationService(
      lots,
      raiser,
      payments,
      {
        evaluate: async () => ({ hold: false, reason: null }),
        peek: async () => ({ hold: false, reason: null }),
      },
      new PaymentTierPolicy(
        parsePaymentTierLimits({
          STRIPE_CARD_CHECKOUT_MAX: 10_000,
          STRIPE_MANUAL_REVIEW_MIN: 500_000,
          STRIPE_ABSOLUTE_MAX: 999_999.99,
        }),
      ),
      {
        computePlatformFee: async () => "0.00",
        computePlatformFeeFromPence: async () => "0.00",
      },
      { isConfigured: () => false, ensureInvoiceForPayment: async () => ({ ok: true }) } as never,
      { stageDispatch: async () => undefined },
      {
        createPaymentDue: () =>
          ({
            type: "payment_due",
            title: "Payment due",
            message: "Payment due",
            lotId: l.id,
            submissionId: null,
            legalEntityId: null,
          }) as never,
      },
      { publish: async () => undefined },
      null,
      null,
      {
        findById: async () => ({ id: buyerId, email: `${buyerId}@integration.test`, name: "B" }),
      } as never,
      { forInvoice: async ({ winnerUserId }) => [winnerUserId] },
    );
    const priced = await raiser.price(l);
    const checkoutDeps = { invoiceRaiser: raiser } as unknown as PaymentServiceDeps;

    const [lotEndResult, checkoutResult] = await Promise.allSettled([
      lotEnd.ensureForLot(l.id),
      createPaymentRecordForWinner(checkoutDeps, l, buyerId, {
        amount: "5000.00",
        priced,
        platformFee: "0.00",
        requiresManualReview: false,
        manualReviewReason: null,
      }),
    ]);

    // The lot-end job never throws: it creates the payment or reports the one that exists.
    expect(lotEndResult.status).toBe("fulfilled");
    // Checkout either creates it, or fails on the open-payment index it then joins on.
    if (checkoutResult.status === "rejected") {
      expect(isOpenPaymentUniqueViolation(checkoutResult.reason)).toBe(true);
    }

    const { invoiceRows, paymentRows, lineRows } = await stored(l.id);
    expect(invoiceRows).toHaveLength(1);
    expect(paymentRows).toHaveLength(1);
    expect(lineRows).toHaveLength(2);
    if (lotEndResult.status === "fulfilled" && lotEndResult.value.paymentId) {
      expect(lotEndResult.value.paymentId).toBe(paymentRows[0]?.id);
    }
    if (checkoutResult.status === "fulfilled") {
      expect(checkoutResult.value.payment.id).toBe(paymentRows[0]?.id);
    }
  });
});
