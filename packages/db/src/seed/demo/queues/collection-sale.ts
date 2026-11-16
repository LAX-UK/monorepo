import { DEFAULT_COLLECTION_WEEKLY_HOURS } from "@auction/domain";
import { standardBuyerPremiumBands } from "@auction/validators";
import * as schema from "../../../schema/index.js";
import { insertSeedInvoices, penceToPounds } from "../../shared/seed-invoice.js";
import { SEED_BUYER_PREMIUM_TERMS } from "../../shared/terms.js";
import { type DemoPayment, SELLER_COMMISSION_RATE, demoPayment } from "../demo-topup-catalogue.js";
import { DEMO_PEOPLE } from "../demo-topup-ids.js";
import { personalEntityOf } from "../demo-topup-seed.js";
import type { QueueContext } from "./queue-context.js";
import { DEMO_STRIPE, DEMO_VENUE, QUEUE_IDS } from "./queue-ids.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const money = (pounds: number) => pounds.toFixed(2);

/**
 * The demo's own saleroom sale: ended ten days ago at the demo collection point, with three paid
 * lots. It belongs to the queue seeders alone, so the demo's other sales are never changed.
 *
 * - Lot 1, bought by Charlotte Hayes and paid on its own, is released for collection: the visit
 *   the collection desk shows is booked for it.
 * - Lots 2 and 3, bought by Northbank Gallery and paid together in one card payment ("Pay
 *   several"), wait for staff to release them (the lot fulfilment list). Their shared charge is the
 *   one the demo dispute is about, so the dispute has two candidate invoices.
 */
export const COLLECTION_SALE = {
  id: QUEUE_IDS.sale(1),
  title: "The Demo Saleroom: Works on Paper",
  lots: [
    { n: 1, title: "Study of a Heron (demo)", hammer: 1_800, medium: "Ink and wash" },
    { n: 2, title: "Estuary Sketch I (demo)", hammer: 2_400, medium: "Watercolour" },
    { n: 3, title: "Estuary Sketch II (demo)", hammer: 2_200, medium: "Watercolour" },
  ],
} as const;

export type CollectionSale = {
  venueId: string;
  saleId: string;
  /** The lot released for collection, and who bought it. */
  bookingLot: { lotId: string; buyerEntityId: string; buyerUserId: string };
  /** The two invoices paid by one charge, the dispute's candidates. */
  groupPayments: { paymentId: string; totalPence: number }[];
};

/** Writes the demo collection point and its sale once; a later run only reads them. */
export async function ensureCollectionSale(context: QueueContext): Promise<CollectionSale> {
  const { db, now } = context;
  const venueId = QUEUE_IDS.venue(1);
  const saleId = COLLECTION_SALE.id;
  const collectorEntityId = personalEntityOf(DEMO_PEOPLE.collector);
  const payments = buildPayments(context, collectorEntityId);

  const venueCreated = await db
    .insert(schema.venue)
    .values({
      id: venueId,
      legalEntityId: context.laxStockId,
      name: DEMO_VENUE.name,
      slug: DEMO_VENUE.slug,
      addressLine1: DEMO_VENUE.addressLine1,
      city: DEMO_VENUE.city,
      postcode: DEMO_VENUE.postcode,
      country: DEMO_VENUE.country,
      contactEmail: DEMO_VENUE.contactEmail,
    })
    .onConflictDoNothing()
    .returning({ id: schema.venue.id });
  if (venueCreated.length > 0) {
    // The place takes bookings with the gallery's default rules and hours (Monday to Friday,
    // 10:00 to 19:00), as staff would set it up. Storage terms are left unset.
    await db.insert(schema.collectionPlace).values({
      venueId,
      onlineBookingEnabled: true,
      updatedByUserId: context.staff.adminUserId,
    });
    await db.insert(schema.collectionWeeklyHours).values(
      DEFAULT_COLLECTION_WEEKLY_HOURS.map((hours, index) => ({
        id: QUEUE_IDS.weeklyHours(index + 1),
        venueId,
        weekday: hours.weekday,
        opensLocal: hours.opensLocal,
        closesLocal: hours.closesLocal,
      })),
    );
  }

  const saleCreated = await db
    .insert(schema.sale)
    .values({
      id: saleId,
      title: COLLECTION_SALE.title,
      description: "Drawings and watercolours sold in the saleroom. Invented for the demo.",
      coverImages: [],
      deliveryMode: "onsite",
      allowOnlineBidsBeforeGoLive: false,
      buyerPremiumRate: "0.1500",
      buyerPremiumTiers: standardBuyerPremiumBands(),
      terms: `${SEED_BUYER_PREMIUM_TERMS} Payment is due within 7 days.`,
      createdByLegalEntityId: context.laxStockId,
      venueId,
      locationName: DEMO_VENUE.name,
      locationCity: DEMO_VENUE.city,
      locationCountry: DEMO_VENUE.country,
      status: "ended",
      previewStartTime: new Date(now - 16 * DAY),
      startTime: new Date(now - 10 * DAY - 3 * HOUR),
      endTime: new Date(now - 10 * DAY),
    })
    .onConflictDoNothing()
    .returning({ id: schema.sale.id });
  if (saleCreated.length > 0) await writeSaleContents(context, payments);

  const bookingPayment = payments[0] as DemoPayment;
  return {
    venueId,
    saleId,
    bookingLot: {
      lotId: bookingPayment.lotId,
      buyerEntityId: bookingPayment.buyerEntityId,
      buyerUserId: bookingPayment.buyerUserId,
    },
    groupPayments: payments
      .slice(1)
      .map((p) => ({ paymentId: p.id, totalPence: p.invoice.totalPence })),
  };
}

function buildPayments(context: QueueContext, collectorEntityId: string): DemoPayment[] {
  const endedAt = context.now - 10 * DAY;
  return COLLECTION_SALE.lots.map((lot) =>
    demoPayment({
      id: QUEUE_IDS.payment(lot.n),
      lotId: QUEUE_IDS.lot(lot.n),
      buyerUserId: lot.n === 1 ? context.people.collector : context.people.northbankBuyer,
      buyerEntityId: lot.n === 1 ? collectorEntityId : context.northbankId,
      sellerEntityId: context.laxStockId,
      hammer: lot.hammer,
      status: "captured",
      createdAt: new Date(endedAt + 2 * HOUR),
      paymentGroupId: lot.n === 1 ? null : QUEUE_IDS.paymentGroup(1),
    }),
  );
}

/** The lots, their invoices and payments, and the fulfilment rows payment and release leave. */
async function writeSaleContents(context: QueueContext, payments: DemoPayment[]) {
  const { db, now } = context;
  const endedAt = new Date(now - 10 * DAY);
  const paidAt = new Date(now - 9 * DAY);
  const category = context.categoryIdBySlug.get("drawings") ?? null;

  for (const [index, spec] of COLLECTION_SALE.lots.entries()) {
    const payment = payments[index] as DemoPayment;
    await db.insert(schema.lot).values({
      id: payment.lotId,
      saleId: COLLECTION_SALE.id,
      lotNumber: spec.n,
      title: spec.title,
      description: "Invented for the demo.",
      medium: spec.medium,
      dimensions: "28 × 38 cm",
      images: [],
      auctionType: "english",
      startingPrice: money(spec.hammer * 0.6),
      reservePrice: money(spec.hammer * 0.7),
      currentPrice: money(spec.hammer),
      minBidIncrement: money(100),
      sellerLegalEntityId: context.laxStockId,
      winnerId: payment.buyerUserId,
      buyerLegalEntityId: payment.buyerEntityId,
      status: "ended",
      startTime: new Date(endedAt.getTime() - 3 * HOUR),
      endTime: endedAt,
    });
    if (category) {
      await db.insert(schema.lotCategories).values({ lotId: payment.lotId, categoryId: category });
    }
  }

  await insertSeedInvoices(
    db,
    payments.map((p) => ({
      lotId: p.lotId,
      buyerLegalEntityId: p.buyerEntityId,
      sellerLegalEntityId: p.sellerEntityId,
      invoice: p.invoice,
    })),
  );
  const group = payments.slice(1);
  const groupTotal = group.reduce((sum, p) => sum + p.invoice.totalPence, 0);
  await db.insert(schema.paymentGroup).values({
    id: QUEUE_IDS.paymentGroup(1),
    buyerLegalEntityId: context.northbankId,
    createdByUserId: context.people.northbankBuyer,
    status: "paid",
    totalAmount: penceToPounds(groupTotal),
    checkoutRail: "card",
    stripePaymentIntentId: DEMO_STRIPE.groupIntent,
    stripeChargeId: DEMO_STRIPE.groupCharge,
    amountReceived: penceToPounds(groupTotal),
    createdAt: paidAt,
    updatedAt: paidAt,
    settledAt: paidAt,
  });
  await db.insert(schema.payment).values(
    payments.map((p) => ({
      id: p.id,
      lotId: p.lotId,
      buyerId: p.buyerUserId,
      buyerLegalEntityId: p.buyerEntityId,
      sellerLegalEntityId: p.sellerEntityId,
      amount: penceToPounds(p.invoice.totalPence),
      platformFee: money((p.invoice.totalPence / 100) * SELLER_COMMISSION_RATE),
      // A "Pay several" payment shares its group's one intent and charge.
      stripePaymentIntentId: p.paymentGroupId ? DEMO_STRIPE.groupIntent : DEMO_STRIPE.bookingIntent,
      stripeChargeId: p.paymentGroupId ? DEMO_STRIPE.groupCharge : DEMO_STRIPE.bookingCharge,
      status: p.status,
      paymentGroupId: p.paymentGroupId,
      invoiceId: p.invoice.id,
      createdAt: p.createdAt,
    })),
  );

  // Payment captured: each lot waits for release (`awaiting_release`, payment cleared), as the
  // payment sync leaves it. Staff released lot 1 and readied it for collection the next day.
  await db.insert(schema.lotFulfilment).values(
    payments.map((p, index) => ({
      id: QUEUE_IDS.fulfilment(index + 1),
      lotId: p.lotId,
      paymentId: p.id,
      paymentClearedAt: paidAt,
      createdAt: paidAt,
      ...(index === 0
        ? {
            status: "ready_for_collection" as const,
            fulfilmentMethod: "collection" as const,
            releaseApprovedByUserId: context.staff.adminUserId,
            releaseApprovedAt: new Date(paidAt.getTime() + DAY),
            updatedAt: new Date(paidAt.getTime() + DAY),
          }
        : { status: "awaiting_release" as const, updatedAt: paidAt }),
    })),
  );
}
