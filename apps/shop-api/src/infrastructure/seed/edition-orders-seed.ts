import type { Database } from "@auction/db";
import { shopArtwork, shopEdition, shopOrder, shopOrderLine } from "@auction/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { completeShopCheckoutSession } from "../drizzle-payment-event.processor.js";

/** The buyer of the demo orders; they exist so LAX Admin's pick list has prints to pack. */
const SEED_BUYER_SUBJECT = "seed:edition-buyer";

/** Numbered demo runs, each given one paid order: the next print on sale is the one sold. */
const NUMBERED_RUN_SLUGS = [
  "harbour-at-dusk",
  "composition-1964",
  "shoreline-estate",
  "harbour-at-dusk-artists-proof",
] as const;

const orderKey = (slug: string) => `seed:edition-order:${slug}`;

async function isOrdered(db: Database, slug: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(eq(shopOrder.idempotencyKey, orderKey(slug)))
    .limit(1);
  return existing !== undefined;
}

async function nextPrintOnSale(db: Database, artworkId: string) {
  const [print] = await db
    .select({
      id: shopEdition.id,
      ownerPartyId: shopEdition.ownerPartyId,
      editionNumber: shopEdition.editionNumber,
    })
    .from(shopEdition)
    .where(
      and(
        eq(shopEdition.artworkId, artworkId),
        eq(shopEdition.listingStatus, "authorised"),
        isNull(shopEdition.reservedByOrderId),
      ),
    )
    .orderBy(asc(shopEdition.stockRef))
    .limit(1);
  return print ?? null;
}

async function orderNextPrint(db: Database, slug: string): Promise<void> {
  const [artwork] = await db
    .select({ id: shopArtwork.id, pricePence: shopArtwork.printPricePence })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, slug))
    .limit(1);
  if (!artwork?.pricePence) return;
  const print = await nextPrintOnSale(db, artwork.id);
  if (!print?.ownerPartyId) return;

  const sessionId = `cs_seed_${slug}`;
  const [order] = await db
    .insert(shopOrder)
    .values({
      identitySubjectId: SEED_BUYER_SUBJECT,
      fulfilment: "collect_brunswick",
      merchandiseSubtotalPence: artwork.pricePence,
      fulfilmentSurchargePence: 0,
      totalPence: artwork.pricePence,
      idempotencyKey: orderKey(slug),
      status: "pending_payment",
      stripeCheckoutSessionId: sessionId,
    })
    .returning({ id: shopOrder.id });
  if (!order) return;
  await db.insert(shopOrderLine).values({
    orderId: order.id,
    editionId: print.id,
    artworkId: artwork.id,
    sellerPartyId: print.ownerPartyId,
    editionNumber: print.editionNumber,
    unitPricePence: artwork.pricePence,
  });
  await db
    .update(shopEdition)
    .set({
      listingStatus: "reserved",
      reservedUntil: new Date(Date.now() + 60 * 60 * 1000),
      reservedByOrderId: order.id,
    })
    .where(eq(shopEdition.id, print.id));
  // Paying through the real handler keeps the facts at payment, the invoice and the fulfilment row.
  await completeShopCheckoutSession(
    db,
    {
      eventId: `evt-seed-${slug}`,
      orderId: order.id,
      sessionId,
      amountTotalPence: artwork.pricePence,
      paidAt: new Date(),
    },
    { domainEventMode: "off" },
  );
}

/**
 * One paid order for each numbered demo run, so LAX Admin has prints to pick and pack, and the
 * order page, invoice and LAX Account show the numbers. Safe to run again: a run that already has
 * its order is skipped. Development and test data only.
 */
export async function seedEditionOrders(db: Database): Promise<void> {
  for (const slug of NUMBERED_RUN_SLUGS) {
    if (await isOrdered(db, slug)) continue;
    await orderNextPrint(db, slug);
  }
}
