/**
 * Gives the demo the Shop and lax.art states the staff queue seed does not reach (GAP-31):
 *
 * - **A dispatched LAX Shop order**: the demo order for "harbour-at-dusk-artists-proof" is moved
 *   through the real fulfilment handler (in production, awaiting dispatch, in transit with a
 *   carrier and a demo tracking number). Its numbered print is confirmed at packing through the
 *   real packing service (`confirm-print.service`), by typing the label written on the print, so
 *   the print history, the `shop.print.pack_confirmed` event, the audit row and any certificate
 *   are written exactly as for staff.
 * - **A returned LAX Shop order**: the demo order for "shoreline-estate" is dispatched the same way,
 *   delivered through the real possession step, then cancelled after possession through the real handler (a return and a cancellation refund), and
 *   the return is moved to in transit and received, back on sale, through the return handler. The
 *   demo orders were paid without Stripe and have no payment intent, so the cancellation refund
 *   could never be sent; like the failed refund of the staff queues seed, it is recorded as a
 *   terminal failure in the same transaction, so the refund scheduler never picks it up.
 * - **One reserved lax.art original**: a reservation of "Quiet Orchard" for an invented buyer,
 *   written by the same original sale writer LAX Admin uses.
 *
 * Insert-once and resumable: each step runs only while its row is in a state the seed itself left
 * it in (the last staff action on it is the seed's), so work staff did afterwards stays, and a run
 * that stopped part-way is finished by the next one. Every handler call has a fixed idempotency
 * key, so replaying a step that already ran changes nothing. A state that cannot be reached (an
 * order or the original missing, or already taken on by staff) is reported in `skipped`, and the
 * script prints it; nothing is skipped silently. Test and local databases only: it refuses a
 * database without the demo seed mark (0398). The events the real handlers write carry the
 * producer `shop-api` (not `demo-seed`); nothing emails anyone about them today.
 */
import { type Database, assertDemoSeedDatabase } from "@auction/db";
import {
  shopAdminAudit,
  shopArtwork,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopParty,
  shopRefund,
  shopReturn,
} from "@auction/db/schema";
import { and, asc, desc, eq, inArray, like, notInArray } from "drizzle-orm";
import { createConfirmPrintService } from "../../application/print-fulfilment/confirm-print.service.js";
import { labelOfPrint } from "../../application/print-fulfilment/print-identity.js";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createAdvanceReturnHandler } from "../handlers/admin/advance-return.handler.js";
import { createCancelAfterPossessionHandler } from "../handlers/admin/cancel-after-possession.handler.js";
import { createRecordPossessionHandler } from "../handlers/admin/record-possession.handler.js";
import { createUpdateFulfilmentHandler } from "../handlers/admin/update-fulfilment.handler.js";
import { createDrizzleOriginalSaleWriter } from "../phase/drizzle-original-sale.writer.js";
import {
  createDrizzlePickListReader,
  createDrizzlePrintFulfilmentUnitOfWork,
} from "../print-fulfilment/drizzle-print-fulfilment.unit-of-work.js";
import { MISSING_INTENT_ERROR } from "./demo-staff-queues-seed.js";
import { seedEditionOrders } from "./edition-orders-seed.js";

/** The demo orders the states use, named by their stable keys (see `edition-orders-seed.ts`). */
export const DISPATCHED_ORDER_KEY = "seed:edition-order:harbour-at-dusk-artists-proof";
export const RETURNED_ORDER_KEY = "seed:edition-order:shoreline-estate";
/** The staff subject the seeded steps run as; it reads as the seed in the audit trail. */
export const DEMO_STATES_ACTOR = "seed:demo-shop-states";
const KEY = "seed:demo-shop-states";
export const DEMO_CARRIER = "Demo Carrier";
export const DEMO_TRACKING_NUMBER = "DEMO-TRACK-0001";
/** The invented buyer of the reserved original: an invented person with no contact details. */
export const DEMO_ORIGINAL_BUYER_SUBJECT = "seed:demo-original-buyer";
export const DEMO_RESERVED_ORIGINAL_SLUG = "quiet-orchard";
const RESERVED_PRICE_PENCE = 145_000;
const DEMO_CANCELLATION_POLICY = { daysAfterPossession: 14, personalisedGoodsExempt: false };
/** The fulfilment steps the seed takes, in order; anything later is out of its hands. */
const DISPATCH_STEPS = ["pending_production", "in_production", "awaiting_dispatch"] as const;

export type DemoShopStateCounts = {
  dispatchedOrders: number;
  returnedOrders: number;
  reservedOriginals: number;
};

/** The counts, plus each state the seed left alone because staff have taken it on, and why. */
export type DemoShopStatesResult = DemoShopStateCounts & { skipped: string[] };

/** A precondition of the seed is missing: the run cannot give the demo every state. */
export class DemoShopStatesPreconditionError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(
      `[demo-shop-states] cannot seed every demo state:\n- ${missing.join("\n- ")}\nRun \`seed:catalogue\` on this database first, then run \`seed:demo-full\` again.`,
    );
    this.name = "DemoShopStatesPreconditionError";
  }
}

type StepOutcome = { missing?: string; skipped?: string } | undefined;

export async function seedDemoShopStates(db: Database): Promise<DemoShopStatesResult> {
  await assertDemoSeedDatabase(db, "shop demo shop states");
  await seedEditionOrders(db);
  const missing: string[] = [];
  const skipped: string[] = [];
  const note = (outcome: StepOutcome) => {
    if (outcome?.missing) missing.push(outcome.missing);
    if (outcome?.skipped) skipped.push(outcome.skipped);
  };

  const dispatched = await orderByKey(db, DISPATCHED_ORDER_KEY);
  if (!dispatched) missing.push(`dispatched order: no demo order ${DISPATCHED_ORDER_KEY}`);
  else note(await dispatchOrder(db, dispatched, "dispatched"));

  const returned = await orderByKey(db, RETURNED_ORDER_KEY);
  if (!returned) missing.push(`returned order: no demo order ${RETURNED_ORDER_KEY}`);
  else {
    const outcome = await dispatchOrder(db, returned, "returned");
    note(outcome);
    if (!outcome) note(await returnOrder(db, returned));
  }
  note(await reserveOriginal(db));

  if (missing.length > 0) throw new DemoShopStatesPreconditionError(missing);
  return { ...(await countStates(db, dispatched?.id, returned?.id)), skipped };
}

type DemoOrder = { id: string; key: string };

async function orderByKey(db: Database, key: string): Promise<DemoOrder | undefined> {
  const [order] = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(eq(shopOrder.idempotencyKey, key))
    .limit(1);
  return order ? { id: order.id, key } : undefined;
}

/** Who last acted on a row through a staff handler (the seed runs as one), from the audit trail. */
async function lastActor(db: Database, targetType: string, targetId: string) {
  const [row] = await db
    .select({ actor: shopAdminAudit.actorSubjectId })
    .from(shopAdminAudit)
    .where(and(eq(shopAdminAudit.targetType, targetType), eq(shopAdminAudit.targetId, targetId)))
    .orderBy(desc(shopAdminAudit.createdAt))
    .limit(1);
  return row?.actor ?? null;
}

/**
 * Moves the order to in transit through the fulfilment handler, resuming from wherever an earlier
 * run stopped. An order staff moved on (the last fulfilment action is not the seed's) is theirs.
 */
async function dispatchOrder(db: Database, order: DemoOrder, label: string): Promise<StepOutcome> {
  const [fulfilment] = await db
    .select({ id: shopFulfilment.id, status: shopFulfilment.status })
    .from(shopFulfilment)
    .where(eq(shopFulfilment.orderId, order.id))
    .limit(1);
  if (!fulfilment) return { missing: `${label} order: ${order.key} has no fulfilment` };
  const from = DISPATCH_STEPS.indexOf(fulfilment.status as (typeof DISPATCH_STEPS)[number]);
  if (from === -1) return undefined; // in transit or later: dispatched already
  const actor = await lastActor(db, "shop_fulfilment", fulfilment.id);
  if (actor !== null && actor !== DEMO_STATES_ACTOR) {
    return {
      skipped: `${label} order: ${order.key} is ${fulfilment.status}, moved there by staff; left as is`,
    };
  }
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
  if (from <= 0) await step("in_production");
  if (from <= 1) {
    await confirmPacking(db, order.id, label);
    await step("awaiting_dispatch");
  }
  await step("in_transit", { carrier: DEMO_CARRIER, trackingNumber: DEMO_TRACKING_NUMBER });
  return undefined;
}

/**
 * The packing gate: each print is confirmed against its line through the real packing service, by
 * typing the label written on the print (the path that needs no label printer or scanner).
 */
async function confirmPacking(db: Database, orderId: string, label: string) {
  const { lines, contexts } = await createDrizzlePickListReader(db).forOrder(orderId);
  const packing = createConfirmPrintService({
    uow: createDrizzlePrintFulfilmentUnitOfWork(createDrizzleShopUnitOfWork(db, "enforce")),
    // LAX-issued certificates stay off in the demo, as they are by default.
    certificateSettings: { laxCertificatesEnabled: () => false },
    clock: { now: () => new Date() },
  });
  for (const line of lines) {
    if (line.released || line.confirmedAt) continue;
    const context = contexts.get(line.artworkId);
    if (!context) throw new Error(`[demo-shop-states] no edition run for line ${line.orderLineId}`);
    const printed = labelOfPrint(line.print, context.run);
    const result = await packing.confirm({
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: printed },
      actorSubjectId: DEMO_STATES_ACTOR,
      idempotencyKey: `${KEY}:${label}:pack:${line.orderLineId}`,
    });
    if (result.outcome !== "confirmed") {
      throw new Error(
        `[demo-shop-states] packing did not confirm ${printed} on line ${line.orderLineId}: ${result.outcome}`,
      );
    }
  }
}

/**
 * Cancels the dispatched order's print after possession, then receives the return back on sale.
 * Each step resumes where an earlier run stopped, but only on rows the seed itself last moved.
 */
async function returnOrder(db: Database, order: DemoOrder): Promise<StepOutcome> {
  const [line] = await db
    .select({ id: shopOrderLine.id, editionId: shopOrderLine.editionId })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.orderId, order.id))
    .orderBy(asc(shopOrderLine.createdAt))
    .limit(1);
  if (!line?.editionId) return { missing: `returned order: ${order.key} has no print line` };
  const editionId = line.editionId;
  const [existing] = await db
    .select({ id: shopReturn.id, status: shopReturn.status })
    .from(shopReturn)
    .where(eq(shopReturn.orderLineId, line.id))
    .limit(1);
  if (existing) return finishReturn(db, order, existing);

  const [fulfilment] = await db
    .select({ id: shopFulfilment.id, status: shopFulfilment.status })
    .from(shopFulfilment)
    .where(eq(shopFulfilment.orderId, order.id))
    .limit(1);
  if (!fulfilment) return { missing: `returned order: ${order.key} has no fulfilment` };
  if ((await lastActor(db, "shop_fulfilment", fulfilment.id)) !== DEMO_STATES_ACTOR) {
    return { skipped: `returned order: ${order.key} was moved on by staff; left as is` };
  }
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
    return { skipped: `returned order: ${order.key} is ${fulfilment.status}; left as is` };
  }

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
          eq(shopRefund.orderId, order.id),
          like(shopRefund.idempotencyKey, `cancellation:${cancelKey}%`),
          eq(shopRefund.status, "pending"),
          eq(shopRefund.submitAttempts, 0),
        ),
      );
    return result.returnId;
  });
  if (!returnId) return { missing: `returned order: cancelling ${order.key} opened no return` };
  return finishReturn(db, order, { id: returnId, status: "requested" });
}

/** Moves the seed's return on to received (back on sale), from wherever it stands. */
async function finishReturn(
  db: Database,
  order: DemoOrder,
  row: { id: string; status: string },
): Promise<StepOutcome> {
  if (row.status === "received") return undefined;
  if (
    !["requested", "in_transit"].includes(row.status) ||
    (await lastActor(db, "shop_return", row.id)) !== DEMO_STATES_ACTOR
  ) {
    return { skipped: `returned order: the return of ${order.key} is ${row.status}; left as is` };
  }
  const advance = createAdvanceReturnHandler({
    uow: createDrizzleShopUnitOfWork(db, "enforce"),
  });
  if (row.status === "requested") {
    await advance({
      returnId: row.id,
      to: "in_transit",
      actorSubjectId: DEMO_STATES_ACTOR,
      idempotencyKey: `${KEY}:returned:in_transit`,
    });
  }
  await advance({
    returnId: row.id,
    to: "received",
    disposition: "back_on_sale",
    actorSubjectId: DEMO_STATES_ACTOR,
    idempotencyKey: `${KEY}:returned:received`,
  });
  return undefined;
}

/**
 * Reserves one lax.art original for an invented buyer. Once the seed has made its reservation,
 * whatever came of it is staff's; another open sale on the original is left alone too.
 */
async function reserveOriginal(db: Database): Promise<StepOutcome> {
  const [artwork] = await db
    .select({ id: shopArtwork.id, saleState: shopArtwork.saleState })
    .from(shopArtwork)
    .where(
      and(eq(shopArtwork.slug, DEMO_RESERVED_ORIGINAL_SLUG), eq(shopArtwork.salesChannel, "art")),
    )
    .limit(1);
  if (!artwork) {
    return {
      missing: `reserved original: no lax.art original "${DEMO_RESERVED_ORIGINAL_SLUG}" (seeded by seed:catalogue)`,
    };
  }
  const [seeded] = await db
    .select({ status: shopOriginalSale.status })
    .from(shopOriginalSale)
    .where(
      and(
        eq(shopOriginalSale.artworkId, artwork.id),
        eq(shopOriginalSale.recordedBySubjectId, DEMO_STATES_ACTOR),
      ),
    )
    .limit(1);
  if (seeded) {
    return seeded.status === "reserved"
      ? undefined
      : {
          skipped: `reserved original: the seeded reservation of "${DEMO_RESERVED_ORIGINAL_SLUG}" is ${seeded.status} now; left as is`,
        };
  }
  const [sale] = await db
    .select({ status: shopOriginalSale.status })
    .from(shopOriginalSale)
    .where(
      and(
        eq(shopOriginalSale.artworkId, artwork.id),
        notInArray(shopOriginalSale.status, ["assigned", "cancelled"]),
      ),
    )
    .limit(1);
  if (sale || artwork.saleState === "sold") {
    return {
      skipped: `reserved original: "${DEMO_RESERVED_ORIGINAL_SLUG}" is ${sale ? `in a ${sale.status} sale` : "sold"} by staff; left as is`,
    };
  }

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
  if (!buyer) return { missing: "reserved original: the demo buyer could not be written" };
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
  return undefined;
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
