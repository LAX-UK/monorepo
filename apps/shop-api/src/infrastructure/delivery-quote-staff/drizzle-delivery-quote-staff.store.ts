import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopDeliveryQuote,
  shopEdition,
  shopGuestCustomer,
  shopOrder,
  shopOrderLine,
} from "@auction/db/schema";
import { parseFramingOrderSnapshot, reservedUntilFromCheckoutExpiry } from "@auction/shop-domain";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { countryNameOf } from "../../application/country-name.js";
import type {
  DeliveryQuoteForUpdate,
  DeliveryQuoteStaffReader,
  DeliveryQuoteStaffRow,
  DeliveryQuoteStaffStore,
  DeliveryQuoteView,
} from "../../application/delivery-quote-staff/delivery-quote-staff.ports.js";

const VIEW_STATUSES: Record<DeliveryQuoteView, readonly string[]> = {
  waiting: ["requested"],
  quoted: ["quoted", "accepted"],
  closed: ["withdrawn"],
};

const LIST_LIMIT = 200;

const columns = {
  id: shopDeliveryQuote.id,
  orderId: shopDeliveryQuote.orderId,
  orderReference: shopOrder.reference,
  orderStatus: shopOrder.status,
  identitySubjectId: shopOrder.identitySubjectId,
  guestEmail: shopGuestCustomer.email,
  status: shopDeliveryQuote.status,
  country: shopDeliveryQuote.destinationCountry,
  regionId: shopDeliveryQuote.regionId,
  recipientName: shopOrder.deliveryRecipientName,
  line1: shopOrder.deliveryLine1,
  line2: shopOrder.deliveryLine2,
  city: shopOrder.deliveryCity,
  postcode: shopOrder.deliveryPostcode,
  phone: shopOrder.deliveryPhone,
  merchandisePence: shopOrder.merchandiseSubtotalPence,
  framingPence: shopOrder.framingSubtotalPence,
  requestedAt: shopDeliveryQuote.requestedAt,
  holdUntil: shopDeliveryQuote.holdUntil,
  quotedPricePence: shopDeliveryQuote.quotedPricePence,
  quotedCarrier: shopDeliveryQuote.quotedCarrier,
  quotedService: shopDeliveryQuote.quotedService,
  quotedLeadTimeNote: shopDeliveryQuote.quotedLeadTimeNote,
  quotedAt: shopDeliveryQuote.quotedAt,
  endReason: shopDeliveryQuote.endReason,
  declineNote: shopDeliveryQuote.declineNote,
};

type QuoteRecord = {
  [K in keyof typeof columns]: (typeof columns)[K]["_"]["data"] | null;
};

function baseQuery(db: Database) {
  return db
    .select(columns)
    .from(shopDeliveryQuote)
    .innerJoin(shopOrder, eq(shopDeliveryQuote.orderId, shopOrder.id))
    .leftJoin(shopGuestCustomer, eq(shopOrder.guestCustomerId, shopGuestCustomer.id));
}

async function itemTitles(
  db: Database,
  orderIds: readonly string[],
): Promise<Map<string, string[]>> {
  const titles = new Map<string, string[]>();
  if (orderIds.length === 0) return titles;
  const lines = await db
    .select({
      orderId: shopOrderLine.orderId,
      title: shopArtwork.title,
      kind: shopOrderLine.kind,
      framingSnapshot: shopOrderLine.framingSnapshot,
    })
    .from(shopOrderLine)
    .leftJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
    .where(inArray(shopOrderLine.orderId, [...orderIds]));
  for (const line of lines) {
    const title =
      line.kind === "framing"
        ? `Framing: ${parseFramingOrderSnapshot(line.framingSnapshot).name}`
        : (line.title ?? "Item");
    titles.set(line.orderId, [...(titles.get(line.orderId) ?? []), title]);
  }
  return titles;
}

function toRow(record: QuoteRecord, items: string[]): DeliveryQuoteStaffRow {
  const quoted =
    record.quotedPricePence !== null && record.quotedCarrier !== null && record.quotedAt !== null;
  return {
    id: record.id as string,
    orderId: record.orderId as string,
    orderReference: record.orderReference as string,
    status: record.status as DeliveryQuoteStaffRow["status"],
    country: record.country as string,
    regionId: record.regionId as DeliveryQuoteStaffRow["regionId"],
    recipientName: record.recipientName,
    address: [
      record.line1,
      record.line2,
      [record.city, record.postcode].filter(Boolean).join(" "),
      countryNameOf(record.country as string),
    ].filter((line): line is string => Boolean(line)),
    phone: record.phone,
    items,
    // What is being bought before delivery: the goods and the framing sold with them.
    merchandisePence: (record.merchandisePence as number) + (record.framingPence as number),
    requestedAt: record.requestedAt as Date,
    holdUntil: record.holdUntil as Date,
    quote: quoted
      ? {
          pricePence: record.quotedPricePence as number,
          carrier: record.quotedCarrier as string,
          service: record.quotedService,
          leadTimeNote: record.quotedLeadTimeNote,
          quotedAt: record.quotedAt as Date,
        }
      : null,
    endReason: record.endReason as DeliveryQuoteStaffRow["endReason"],
    declineNote: record.declineNote,
  };
}

/** Lists the requests staff work through, oldest waiting first. */
export function createDrizzleDeliveryQuoteStaffReader(db: Database): DeliveryQuoteStaffReader {
  return {
    async list(view) {
      const rows = await baseQuery(db)
        .where(inArray(shopDeliveryQuote.status, [...VIEW_STATUSES[view]]))
        .orderBy(
          view === "waiting"
            ? asc(shopDeliveryQuote.requestedAt)
            : desc(shopDeliveryQuote.requestedAt),
        )
        .limit(LIST_LIMIT);
      const titles = await itemTitles(
        db,
        rows.map((row) => row.orderId),
      );
      return rows.map((row) => toRow(row as QuoteRecord, titles.get(row.orderId) ?? []));
    },
    async waitingCount() {
      const [row] = await db
        .select({ waiting: count() })
        .from(shopDeliveryQuote)
        .innerJoin(shopOrder, eq(shopDeliveryQuote.orderId, shopOrder.id))
        .where(
          and(eq(shopDeliveryQuote.status, "requested"), eq(shopOrder.status, "pending_payment")),
        );
      return row?.waiting ?? 0;
    },
  };
}

/** Reads and writes one quote inside a transaction. */
export function createDrizzleDeliveryQuoteStaffStore(db: Database): DeliveryQuoteStaffStore {
  return {
    async lock(quoteId): Promise<DeliveryQuoteForUpdate | null> {
      // Quote and order are locked together, so a buyer's cancel or the reaper waits.
      await db
        .select({ id: shopOrder.id })
        .from(shopDeliveryQuote)
        .innerJoin(shopOrder, eq(shopDeliveryQuote.orderId, shopOrder.id))
        .where(eq(shopDeliveryQuote.id, quoteId))
        .for("update");
      const [record] = await baseQuery(db).where(eq(shopDeliveryQuote.id, quoteId)).limit(1);
      if (!record) return null;
      const titles = await itemTitles(db, [record.orderId]);
      return {
        row: toRow(record as QuoteRecord, titles.get(record.orderId) ?? []),
        orderStatus: record.orderStatus,
        identitySubjectId: record.identitySubjectId,
        guestEmail: record.guestEmail,
      };
    },

    async saveQuote(input) {
      await db
        .update(shopDeliveryQuote)
        .set({
          status: "quoted",
          quotedPricePence: input.pricePence,
          quotedCarrier: input.carrier,
          quotedService: input.service,
          quotedLeadTimeNote: input.leadTimeNote,
          quotedAt: input.at,
          quotedBySubjectId: input.actorSubjectId,
          holdUntil: input.holdUntil,
          updatedAt: input.at,
        })
        .where(eq(shopDeliveryQuote.id, input.quoteId));
      // The hold runs on, so the buyer has time to pay: the order's expiry and the prints' reservation.
      await db
        .update(shopOrder)
        .set({ checkoutExpiresAt: input.holdUntil, updatedAt: input.at })
        .where(eq(shopOrder.id, input.orderId));
      await db
        .update(shopEdition)
        .set({ reservedUntil: reservedUntilFromCheckoutExpiry(input.holdUntil) })
        .where(
          and(
            eq(shopEdition.reservedByOrderId, input.orderId),
            eq(shopEdition.listingStatus, "reserved"),
          ),
        );
    },

    async decline(input) {
      await db
        .update(shopDeliveryQuote)
        .set({
          status: "withdrawn",
          endReason: "cannot_deliver",
          declineNote: input.note,
          decidedAt: input.at,
          updatedAt: input.at,
        })
        .where(eq(shopDeliveryQuote.id, input.quoteId));
    },
  };
}
