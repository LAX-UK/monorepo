/**
 * Gives the demo the Shop and lax.art states the staff queue seed does not reach (GAP-31):
 *
 * - **A dispatched LAX Shop order**: the third numbered demo order is moved through the real
 *   fulfilment handler (in production, awaiting dispatch, in transit with a carrier and a demo
 *   tracking number). The seed confirms the packing of its numbered print itself, as the packing
 *   gate needs, with the seed as the confirming actor.
 * - **A returned LAX Shop order**: the fourth numbered demo order is dispatched the same way,
 *   delivered through the real possession step, then cancelled after possession through the real handler (a return and a cancellation refund), and
 *   the return is moved to in transit and received, back on sale, through the return handler. The
 *   demo orders were paid without Stripe and have no payment intent, so the cancellation refund
 *   could never be sent; like the failed refund of the staff queues seed, it is recorded as a
 *   terminal failure in the same transaction, so the refund scheduler never picks it up.
 * - **One reserved lax.art original**: a reservation of "Quiet Orchard" for an invented buyer,
 *   written by the same original sale writer LAX Admin uses.
 *
 * Insert-once: each step runs only while its row is still in the state the seed leaves it before
 * that step, so work staff did afterwards stays. Test and local databases only: it refuses a
 * database without the demo seed mark (0398). The events the real handlers write carry the
 * producer `shop-api` (not `demo-seed`); nothing emails anyone about them today.
 */
import { type Database, assertDemoSeedDatabase } from "@auction/db";
import {
  shopArtwork,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopParty,
  shopRefund,
  shopReturn,
} from "@auction/db/schema";
import { and, asc, eq, inArray, like, ne, notInArray } from "drizzle-orm";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createAdvanceReturnHandler } from "../handlers/admin/advance-return.handler.js";
import { createCancelAfterPossessionHandler } from "../handlers/admin/cancel-after-possession.handler.js";
import { createRecordPossessionHandler } from "../handlers/admin/record-possession.handler.js";
import { createUpdateFulfilmentHandler } from "../handlers/admin/update-fulfilment.handler.js";
import { createDrizzleOriginalSaleWriter } from "../phase/drizzle-original-sale.writer.js";
import { MISSING_INTENT_ERROR } from "./demo-staff-queues-seed.js";
import { seedEditionOrders } from "./edition-orders-seed.js";

const SEED_ORDER_KEY_PREFIX = "seed:edition-order:";
/** The staff subject the seeded steps run as; it reads as the seed in the audit trail. */
export const DEMO_STATES_ACTOR = "seed:demo-shop-states";
const KEY = "seed:demo-shop-states";
export const DEMO_CARRIER = "Demo Carrier";
export const DEMO_TRACKING_NUMBER = "DEMO-TRACK-0001";
/** The invented buyer of the reserved original (an example.test person, never a real one). */
export const DEMO_ORIGINAL_BUYER_SUBJECT = "seed:demo-original-buyer";
export const DEMO_RESERVED_ORIGINAL_SLUG = "quiet-orchard";
const RESERVED_PRICE_PENCE = 145_000;
const DEMO_CANCELLATION_POLICY = { daysAfterPossession: 14, personalisedGoodsExempt: false };
const PAID_STATUSES = ["paid", "partially_refunded"] as const;

export type DemoShopStateCounts = {
  dispatchedOrders: number;
  returnedOrders: number;
  reservedOriginals: number;
};

/** Which paid numbered order is dispatched and which is returned (the first two belong to the queues seed). */
export function assignStateOrders<T>(orders: readonly T[]): {
  dispatched: T | undefined;
  returned: T | undefined;
} {
  return { dispatched: orders[2], returned: orders[3] };
}

export async function seedDemoShopStates(db: Database): Promise<DemoShopStateCounts> {
  await assertDemoSeedDatabase(db, "shop demo shop states");
  await seedEditionOrders(db);
  const orders = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(
      and(
        like(shopOrder.idempotencyKey, `${SEED_ORDER_KEY_PREFIX}%`),
        inArray(shopOrder.status, [...PAID_STATUSES]),
      ),
    )
    .orderBy(asc(shopOrder.idempotencyKey));
  const { dispatched, returned } = assignStateOrders(orders);

  if (dispatched) await dispatchOrder(db, dispatched.id, "dispatched");
  if (returned) {
    await dispatchOrder(db, returned.id, "returned");
    await returnOrder(db, returned.id);
  }
  await reserveOriginal(db);
  return countStates(db, dispatched?.id, returned?.id);
}

/** Moves a fresh order to in transit through the fulfilment handler; a moved order is left alone. */
async function dispatchOrder(db: Database, orderId: string, label: string) {
  const [fulfilment] = await db
    .select({ id: shopFulfilment.id, status: shopFulfilment.status })
    .from(shopFulfilment)
    .where(eq(shopFulfilment.orderId, orderId))
    .limit(1);
  if (!fulfilment || fulfilment.status !== "pending_production") return;
  const update = createUpdateFulfilmentHandler({
    uow: createDrizzleShopUnitOfWork(db, "enforce"),
    storefrontUrl: "https://shop.example.test",
  });
  const step = (status: string, extra: { carrier?: string; trackingNumber?: string } = {}) =>
    update({
      fulfilmentId: fulfilment.id,
      status,
      actorSubjectId: DEMO_STATES_ACTOR,
      idempotencyKey: `${KEY}:${label}:${status}`,
      ...extra,
    });
  await step("in_production");
  // The packing gate: a numbered print ships only once packing confirmed it against its line.
  await db
    .update(shopOrderLine)
    .set({ packConfirmedAt: new Date(), packConfirmedBy: DEMO_STATES_ACTOR })
    .where(eq(shopOrderLine.orderId, orderId));
  await step("awaiting_dispatch");
  await step("in_transit", { carrier: DEMO_CARRIER, trackingNumber: DEMO_TRACKING_NUMBER });
}

/** Cancels the dispatched order's print after possession, then receives the return back on sale. */
async function returnOrder(db: Database, orderId: string) {
  const [line] = await db
    .select({ id: shopOrderLine.id, editionId: shopOrderLine.editionId })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.orderId, orderId))
    .orderBy(asc(shopOrderLine.createdAt))
    .limit(1);
  if (!line?.editionId) return;
  const [existing] = await db
    .select({ id: shopReturn.id })
    .from(shopReturn)
    .where(eq(shopReturn.orderLineId, line.id))
    .limit(1);
  // Only an order the seed dispatched, with no return yet, is returned; a return that exists, or an
  // order staff moved on, is theirs now.
  const [fulfilment] = await db
    .select({ id: shopFulfilment.id, status: shopFulfilment.status })
    .from(shopFulfilment)
    .where(eq(shopFulfilment.orderId, orderId))
    .limit(1);
  if (existing || !fulfilment) return;
  if (fulfilment.status === "in_transit") {
    // The buyer has the print: the real possession step sets the cancellation period (a demo policy
    // of 14 days, not read from the environment) that a cancellation after possession needs.
    const recordPossession = createRecordPossessionHandler({
      uow: createDrizzleShopUnitOfWork(db, "enforce"),
      policy: DEMO_CANCELLATION_POLICY,
    });
    await recordPossession({
      fulfilmentId: fulfilment.id,
      status: "delivered",
      possessionAt: new Date().toISOString(),
      actorSubjectId: DEMO_STATES_ACTOR,
      idempotencyKey: `${KEY}:returned:possession`,
    });
  } else if (fulfilment.status !== "delivered") {
    return;
  }

  const editionId = line.editionId;
  const cancelKey = `${KEY}:returned:cancel`;
  const returnId = await db.transaction(async (tx) => {
    const cancel = createCancelAfterPossessionHandler({
      uow: createDrizzleShopUnitOfWork(tx as Database, "enforce"),
    });
    const result = await cancel({
      orderLineId: line.id,
      editionId,
      actorSubjectId: DEMO_STATES_ACTOR,
      idempotencyKey: cancelKey,
    });
    // No payment intent exists, so the refunds can never be sent: record that outcome now, only on
    // the rows just requested and still untouched, so the scheduler never submits them.
    await tx
      .update(shopRefund)
      .set({ status: "failed", submitAttempts: 1, lastError: MISSING_INTENT_ERROR })
      .where(
        and(
          eq(shopRefund.orderId, orderId),
          like(shopRefund.idempotencyKey, `cancellation:${cancelKey}%`),
          eq(shopRefund.status, "pending"),
          eq(shopRefund.submitAttempts, 0),
        ),
      );
    return result.returnId;
  });
  if (!returnId) return;
  const advance = createAdvanceReturnHandler({
    uow: createDrizzleShopUnitOfWork(db, "enforce"),
  });
  await advance({
    returnId,
    to: "in_transit",
    actorSubjectId: DEMO_STATES_ACTOR,
    idempotencyKey: `${KEY}:returned:in_transit`,
  });
  await advance({
    returnId,
    to: "received",
    disposition: "back_on_sale",
    actorSubjectId: DEMO_STATES_ACTOR,
    idempotencyKey: `${KEY}:returned:received`,
  });
}

/** Reserves one lax.art original for an invented buyer, unless it already has an open sale. */
async function reserveOriginal(db: Database) {
  const [artwork] = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(
      and(
        eq(shopArtwork.slug, DEMO_RESERVED_ORIGINAL_SLUG),
        eq(shopArtwork.salesChannel, "art"),
        ne(shopArtwork.saleState, "sold"),
      ),
    )
    .limit(1);
  if (!artwork) return;
  // Any sale that is not finished (or one the seed made before, whatever came of it) is left alone.
  const [sale] = await db
    .select({ id: shopOriginalSale.id })
    .from(shopOriginalSale)
    .where(
      and(
        eq(shopOriginalSale.artworkId, artwork.id),
        notInArray(shopOriginalSale.status, ["assigned", "cancelled"]),
      ),
    )
    .limit(1);
  const [seeded] = await db
    .select({ id: shopOriginalSale.id })
    .from(shopOriginalSale)
    .where(
      and(
        eq(shopOriginalSale.artworkId, artwork.id),
        eq(shopOriginalSale.recordedBySubjectId, DEMO_STATES_ACTOR),
      ),
    )
    .limit(1);
  if (sale || seeded) return;

  let [buyer] = await db
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, DEMO_ORIGINAL_BUYER_SUBJECT))
    .limit(1);
  if (!buyer) {
    [buyer] = await db
      .insert(shopParty)
      .values({
        displayName: "Demo Original Buyer",
        identitySubjectId: DEMO_ORIGINAL_BUYER_SUBJECT,
        kind: "person",
      })
      .onConflictDoNothing()
      .returning({ id: shopParty.id });
  }
  if (!buyer) return;
  const writer = createDrizzleOriginalSaleWriter({
    db,
    uow: createDrizzleShopUnitOfWork(db, "enforce"),
    invoiceGateway: {
      createAndFinalizeOriginalSaleInvoice: async () => {
        throw new Error("The demo seed issues no invoice");
      },
    },
    domainEventMode: "enforce",
  });
  await writer.createReservation({
    artworkId: artwork.id,
    buyerPartyId: buyer.id,
    salePricePence: RESERVED_PRICE_PENCE,
    actorSubjectId: DEMO_STATES_ACTOR,
    salesChannel: "art",
  });
}

async function countStates(
  db: Database,
  dispatchedId: string | undefined,
  returnedId: string | undefined,
): Promise<DemoShopStateCounts> {
  const inTransit = dispatchedId
    ? await db
        .select({ id: shopFulfilment.id })
        .from(shopFulfilment)
        .where(
          and(
            eq(shopFulfilment.orderId, dispatchedId),
            inArray(shopFulfilment.status, ["in_transit", "delivered"]),
          ),
        )
    : [];
  const received = returnedId
    ? await db
        .select({ id: shopReturn.id })
        .from(shopReturn)
        .innerJoin(shopOrderLine, eq(shopOrderLine.id, shopReturn.orderLineId))
        .where(and(eq(shopOrderLine.orderId, returnedId), eq(shopReturn.status, "received")))
    : [];
  const reserved = await db
    .select({ id: shopOriginalSale.id })
    .from(shopOriginalSale)
    .where(
      and(
        eq(shopOriginalSale.recordedBySubjectId, DEMO_STATES_ACTOR),
        eq(shopOriginalSale.status, "reserved"),
      ),
    );
  return {
    dispatchedOrders: inTransit.length,
    returnedOrders: received.length,
    reservedOriginals: reserved.length,
  };
}
