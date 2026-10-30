import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopEdition,
  shopFulfilment,
  shopGeneralEnquiry,
  shopOrder,
  shopOrderLine,
  shopParty,
  shopProduct,
  shopProductVariant,
  shopRefund,
} from "@auction/db/schema";
import {
  SHOP_FULFILMENT_STATUSES,
  SHOP_ORDER_STATUSES,
  type ShopFulfilmentStatus,
  type ShopOrderStatus,
} from "@auction/shop-domain";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type {
  ListOrdersResult,
  OrderLineRecord,
  OrderProgressRecord,
  OrderReader,
  OrderRecord,
  OrderRefundRecord,
  ShopDeliveryAddressRecord,
} from "../application/ports/commerce.ports.js";
import { MAX_ORDER_LIST_LIMIT } from "../application/ports/commerce.ports.js";
import { readShopCustomerContact } from "./resolve-shop-user-email.js";

function deliveryAddressFromOrder(
  order: typeof shopOrder.$inferSelect,
): ShopDeliveryAddressRecord | null {
  if (
    !order.deliveryLine1 ||
    !order.deliveryCity ||
    !order.deliveryPostcode ||
    !order.deliveryCountry
  ) {
    return null;
  }
  return {
    ...(order.deliveryRecipientName ? { recipientName: order.deliveryRecipientName } : {}),
    line1: order.deliveryLine1,
    ...(order.deliveryLine2 ? { line2: order.deliveryLine2 } : {}),
    city: order.deliveryCity,
    postcode: order.deliveryPostcode,
    country: order.deliveryCountry,
  };
}

/** The column is an enum, so an unknown value means the schema moved ahead of this code. */
export function parseOrderStatus(value: string): ShopOrderStatus {
  const known = SHOP_ORDER_STATUSES.find((status) => status === value);
  if (!known) {
    throw new Error(`Unknown shop order status "${value}"`);
  }
  return known;
}

function parseFulfilmentStatus(value: string): ShopFulfilmentStatus {
  const known = SHOP_FULFILMENT_STATUSES.find((status) => status === value);
  if (!known) {
    throw new Error(`Unknown shop fulfilment status "${value}"`);
  }
  return known;
}

/** Statuses in which a paid order still holds its editions. */
const HOLDING_STATUSES: ReadonlySet<ShopOrderStatus> = new Set(["paid", "partially_refunded"]);

export type LineRow = Omit<OrderLineRecord, "editionNumber"> & {
  orderId: string;
  editionNumber: number | null;
  releasedAt: Date | null;
};

export type OrderExtras = {
  lines: LineRow[];
  refunds: Array<OrderRefundRecord & { orderLineId: string | null }>;
  progress: OrderProgressRecord | null;
  problemReports: Date[];
};

/**
 * An edition number is the shopper's only while the order is paid and still holds that edition:
 * the line was not released and has not been refunded in full. Anything else shows no number.
 */
export function visibleEditionNumber(
  status: ShopOrderStatus,
  line: LineRow,
  refunds: OrderExtras["refunds"],
): number | null {
  if (line.editionNumber === null || line.releasedAt !== null) return null;
  if (!HOLDING_STATUSES.has(status)) return null;
  const refundedOnLine = refunds
    .filter((refund) => refund.status === "succeeded" && refund.orderLineId === line.orderLineId)
    .reduce((sum, refund) => sum + refund.amountPence, 0);
  return refundedOnLine >= line.unitPricePence && line.unitPricePence > 0
    ? null
    : line.editionNumber;
}

function orderRowToRecord(order: typeof shopOrder.$inferSelect, extras: OrderExtras): OrderRecord {
  const status = parseOrderStatus(order.status);
  const refunds = extras.refunds.map(({ orderLineId: _line, ...refund }) => refund);
  return {
    orderId: order.id,
    reference: order.reference,
    invoiceNumber: order.invoiceNumber,
    status,
    fulfilment: order.fulfilment,
    merchandiseSubtotalPence: order.merchandiseSubtotalPence,
    fulfilmentSurchargePence: order.fulfilmentSurchargePence,
    fulfilmentVatPence: order.fulfilmentVatPence,
    totalPence: order.totalPence,
    refundedPence: refunds
      .filter((refund) => refund.status === "succeeded")
      .reduce((sum, refund) => sum + refund.amountPence, 0),
    lines: extras.lines.map((line) => {
      const { orderId: _order, releasedAt: _released, ...record } = line;
      return { ...record, editionNumber: visibleEditionNumber(status, line, extras.refunds) };
    }),
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    checkoutExpiresAt: order.checkoutExpiresAt,
    refundPeriodEndsAt: order.refundPeriodEndsAt,
    deliveryAddress: deliveryAddressFromOrder(order),
    progress: extras.progress,
    refunds,
    problemReports: extras.problemReports,
  };
}

const editionSize = sql<number | null>`(
  select nullif(count(*), 0)::int from ${shopEdition} where ${shopEdition.artworkId} = ${shopOrderLine.artworkId}
)`;

async function fetchLinesByOrderIds(
  db: Database,
  orderIds: string[],
): Promise<Map<string, LineRow[]>> {
  if (orderIds.length === 0) return new Map();
  const lineRows = await db
    .select({
      orderId: shopOrderLine.orderId,
      orderLineId: shopOrderLine.id,
      artworkSlug: shopArtwork.slug,
      artworkTitle: shopArtwork.title,
      artistName: shopParty.displayName,
      productVariantId: shopOrderLine.productVariantId,
      productSlug: shopProduct.slug,
      productTitle: shopProduct.title,
      variantSku: shopProductVariant.sku,
      editionNumber: shopOrderLine.editionNumber,
      editionSize,
      unitPricePence: shopOrderLine.unitPricePence,
      vatRateBp: shopOrderLine.vatRateBp,
      vatPence: shopOrderLine.vatPence,
      imageUrl: shopArtwork.primaryImageUrl,
      releasedAt: shopOrderLine.releasedAt,
      createdAt: shopOrderLine.createdAt,
    })
    .from(shopOrderLine)
    .leftJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
    .leftJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
    .leftJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
    .leftJoin(shopProductVariant, eq(shopOrderLine.productVariantId, shopProductVariant.id))
    .leftJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
    .where(inArray(shopOrderLine.orderId, orderIds))
    .orderBy(shopOrderLine.createdAt, shopOrderLine.id);
  const linesByOrder = new Map<string, LineRow[]>();
  for (const { createdAt: _created, ...line } of lineRows) {
    const bucket = linesByOrder.get(line.orderId) ?? [];
    bucket.push({
      ...line,
      artistName: line.artistName?.trim() || null,
      editionSize: line.editionSize === null ? null : Number(line.editionSize),
    });
    linesByOrder.set(line.orderId, bucket);
  }
  return linesByOrder;
}

async function fetchRefundsByOrderIds(
  db: Database,
  orderIds: string[],
): Promise<Map<string, OrderExtras["refunds"]>> {
  if (orderIds.length === 0) return new Map();
  const rows = await db
    .select({
      orderId: shopRefund.orderId,
      orderLineId: shopRefund.orderLineId,
      amountPence: shopRefund.amountPence,
      source: shopRefund.source,
      status: shopRefund.status,
      createdAt: shopRefund.createdAt,
      updatedAt: shopRefund.updatedAt,
    })
    .from(shopRefund)
    .where(
      and(
        inArray(shopRefund.orderId, orderIds),
        inArray(shopRefund.status, ["pending", "succeeded"]),
      ),
    )
    .orderBy(shopRefund.createdAt, shopRefund.id);
  const byOrder = new Map<string, OrderExtras["refunds"]>();
  for (const row of rows) {
    const bucket = byOrder.get(row.orderId) ?? [];
    const succeeded = row.status === "succeeded";
    bucket.push({
      orderLineId: row.orderLineId,
      amountPence: row.amountPence,
      source: row.source,
      status: succeeded ? "succeeded" : "pending",
      requestedAt: row.createdAt,
      // A refund row changes for the last time when Stripe confirms it.
      refundedAt: succeeded ? row.updatedAt : null,
    });
    byOrder.set(row.orderId, bucket);
  }
  return byOrder;
}

async function fetchProgressByOrderIds(
  db: Database,
  orderIds: string[],
): Promise<Map<string, OrderProgressRecord>> {
  if (orderIds.length === 0) return new Map();
  const rows = await db
    .select({
      orderId: shopFulfilment.orderId,
      status: shopFulfilment.status,
      carrier: shopFulfilment.carrier,
      trackingNumber: shopFulfilment.trackingNumber,
      productionStartedAt: shopFulfilment.productionStartedAt,
      dispatchedAt: shopFulfilment.dispatchedAt,
      readyForCollectionAt: shopFulfilment.readyForCollectionAt,
      possessionAt: shopFulfilment.possessionAt,
      cancelledAt: shopFulfilment.cancelledAt,
    })
    .from(shopFulfilment)
    .where(inArray(shopFulfilment.orderId, orderIds));
  return new Map(
    rows.map(({ orderId, status, carrier, trackingNumber, ...dates }) => [
      orderId,
      {
        status: parseFulfilmentStatus(status),
        carrier: carrier?.trim() || null,
        trackingNumber: trackingNumber?.trim() || null,
        ...dates,
      },
    ]),
  );
}

/**
 * When the buyer reported problems on these orders: their own reports in the enquiry inbox,
 * named by the order reference.
 */
async function fetchProblemReports(
  db: Database,
  orders: Array<typeof shopOrder.$inferSelect>,
): Promise<Map<string, Date[]>> {
  const subjects = [...new Set(orders.map((order) => order.identitySubjectId))];
  const references = orders.map((order) => order.reference);
  if (references.length === 0) return new Map();
  const rows = await db
    .select({ reference: shopGeneralEnquiry.contextSlug, createdAt: shopGeneralEnquiry.createdAt })
    .from(shopGeneralEnquiry)
    .where(
      and(
        eq(shopGeneralEnquiry.topic, "order_problem"),
        inArray(shopGeneralEnquiry.contextSlug, references),
        inArray(shopGeneralEnquiry.identitySubjectId, subjects),
      ),
    )
    .orderBy(shopGeneralEnquiry.createdAt);
  const byReference = new Map<string, Date[]>();
  for (const row of rows) {
    if (!row.reference) continue;
    byReference.set(row.reference, [...(byReference.get(row.reference) ?? []), row.createdAt]);
  }
  return byReference;
}

async function hydrateOrders(
  db: Database,
  orders: Array<typeof shopOrder.$inferSelect>,
): Promise<OrderRecord[]> {
  const ids = orders.map((order) => order.id);
  const [linesByOrder, refundsByOrder, progressByOrder, reportsByReference] = await Promise.all([
    fetchLinesByOrderIds(db, ids),
    fetchRefundsByOrderIds(db, ids),
    fetchProgressByOrderIds(db, ids),
    fetchProblemReports(db, orders),
  ]);
  return orders.map((order) =>
    orderRowToRecord(order, {
      lines: linesByOrder.get(order.id) ?? [],
      refunds: refundsByOrder.get(order.id) ?? [],
      progress: progressByOrder.get(order.id) ?? null,
      problemReports: reportsByReference.get(order.reference) ?? [],
    }),
  );
}

export function createDrizzleOrderRepository(db: Database): OrderReader {
  return {
    async listOrders(subject, input): Promise<ListOrdersResult> {
      const limit = Math.min(Math.max(input.limit, 1), MAX_ORDER_LIST_LIMIT);
      const cursor = input.cursor ?? null;

      const orders = await db
        .select()
        .from(shopOrder)
        .where(
          and(
            eq(shopOrder.identitySubjectId, subject),
            cursor
              ? or(
                  lt(shopOrder.createdAt, cursor.createdAt),
                  and(eq(shopOrder.createdAt, cursor.createdAt), lt(shopOrder.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(shopOrder.createdAt), desc(shopOrder.id))
        .limit(limit + 1);

      const hasMore = orders.length > limit;
      const page = hasMore ? orders.slice(0, limit) : orders;
      if (page.length === 0) return { items: [] };

      const items = await hydrateOrders(db, page);
      const last = page.at(-1);
      if (hasMore && last) {
        return {
          items,
          nextCursor: { createdAt: last.createdAt, id: last.id },
        };
      }
      return { items };
    },

    async getOrder(subject, orderId) {
      const [order] = await db
        .select()
        .from(shopOrder)
        .where(and(eq(shopOrder.id, orderId), eq(shopOrder.identitySubjectId, subject)))
        .limit(1);
      if (!order) return null;
      const [record] = await hydrateOrders(db, [order]);
      return record ?? null;
    },

    getCustomerProfile(subject) {
      return readShopCustomerContact(db, subject);
    },
  };
}
