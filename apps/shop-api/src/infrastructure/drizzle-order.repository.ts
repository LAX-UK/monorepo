import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopOrder,
  shopOrderLine,
  shopProduct,
  shopProductVariant,
  shopRefund,
} from "@auction/db/schema";
import { SHOP_ORDER_STATUSES, type ShopOrderStatus } from "@auction/shop-domain";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type {
  ListOrdersResult,
  OrderReader,
  OrderRecord,
  ShopDeliveryAddressRecord,
} from "../application/ports/commerce.ports.js";
import { MAX_ORDER_LIST_LIMIT } from "../application/ports/commerce.ports.js";

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

function orderRowToRecord(
  order: typeof shopOrder.$inferSelect,
  lines: OrderRecord["lines"],
  refundedPence: number,
): OrderRecord {
  return {
    orderId: order.id,
    status: parseOrderStatus(order.status),
    fulfilment: order.fulfilment,
    merchandiseSubtotalPence: order.merchandiseSubtotalPence,
    fulfilmentSurchargePence: order.fulfilmentSurchargePence,
    totalPence: order.totalPence,
    refundedPence,
    lines,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    deliveryAddress: deliveryAddressFromOrder(order),
  };
}

async function fetchLinesByOrderIds(
  db: Database,
  orderIds: string[],
): Promise<Map<string, OrderRecord["lines"]>> {
  if (orderIds.length === 0) return new Map();
  const lineRows = await db
    .select({
      orderId: shopOrderLine.orderId,
      orderLineId: shopOrderLine.id,
      artworkSlug: shopArtwork.slug,
      artworkTitle: shopArtwork.title,
      productVariantId: shopOrderLine.productVariantId,
      productSlug: shopProduct.slug,
      productTitle: shopProduct.title,
      variantSku: shopProductVariant.sku,
      editionNumber: shopOrderLine.editionNumber,
      unitPricePence: shopOrderLine.unitPricePence,
    })
    .from(shopOrderLine)
    .leftJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
    .leftJoin(shopProductVariant, eq(shopOrderLine.productVariantId, shopProductVariant.id))
    .leftJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
    .where(inArray(shopOrderLine.orderId, orderIds));
  const linesByOrder = new Map<string, OrderRecord["lines"]>();
  for (const line of lineRows) {
    const bucket = linesByOrder.get(line.orderId) ?? [];
    bucket.push({
      orderLineId: line.orderLineId,
      artworkSlug: line.artworkSlug,
      artworkTitle: line.artworkTitle,
      productVariantId: line.productVariantId,
      productSlug: line.productSlug,
      productTitle: line.productTitle,
      variantSku: line.variantSku,
      editionNumber: line.editionNumber,
      unitPricePence: line.unitPricePence,
    });
    linesByOrder.set(line.orderId, bucket);
  }
  return linesByOrder;
}

async function fetchRefundedPenceByOrderIds(
  db: Database,
  orderIds: string[],
): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();
  const rows = await db
    .select({
      orderId: shopRefund.orderId,
      refundedPence: sql<number>`coalesce(sum(${shopRefund.amountPence}), 0)::int`,
    })
    .from(shopRefund)
    .where(and(inArray(shopRefund.orderId, orderIds), eq(shopRefund.status, "succeeded")))
    .groupBy(shopRefund.orderId);
  return new Map(rows.map((row) => [row.orderId, row.refundedPence]));
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

      const linesByOrder = await fetchLinesByOrderIds(
        db,
        page.map((order) => order.id),
      );
      const refundedByOrder = await fetchRefundedPenceByOrderIds(
        db,
        page.map((order) => order.id),
      );
      const items = page.map((order) =>
        orderRowToRecord(
          order,
          linesByOrder.get(order.id) ?? [],
          refundedByOrder.get(order.id) ?? 0,
        ),
      );
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
      const linesByOrder = await fetchLinesByOrderIds(db, [order.id]);
      const refundedByOrder = await fetchRefundedPenceByOrderIds(db, [order.id]);
      return orderRowToRecord(
        order,
        linesByOrder.get(order.id) ?? [],
        refundedByOrder.get(order.id) ?? 0,
      );
    },
  };
}
