import type { Database } from "@auction/db";
import { shopArtwork, shopOrder, shopOrderLine } from "@auction/db/schema";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
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

function orderRowToRecord(
  order: typeof shopOrder.$inferSelect,
  lines: OrderRecord["lines"],
): OrderRecord {
  const status = order.status as OrderRecord["status"];
  return {
    orderId: order.id,
    status,
    fulfilment: order.fulfilment,
    merchandiseSubtotalPence: order.merchandiseSubtotalPence,
    fulfilmentSurchargePence: order.fulfilmentSurchargePence,
    totalPence: order.totalPence,
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
      slug: shopArtwork.slug,
      title: shopArtwork.title,
      editionNumber: shopOrderLine.editionNumber,
      unitPricePence: shopOrderLine.unitPricePence,
    })
    .from(shopOrderLine)
    .innerJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
    .where(inArray(shopOrderLine.orderId, orderIds));
  const linesByOrder = new Map<string, OrderRecord["lines"]>();
  for (const line of lineRows) {
    const bucket = linesByOrder.get(line.orderId) ?? [];
    bucket.push({
      orderLineId: line.orderLineId,
      artworkSlug: line.slug,
      artworkTitle: line.title,
      editionNumber: line.editionNumber,
      unitPricePence: line.unitPricePence,
    });
    linesByOrder.set(line.orderId, bucket);
  }
  return linesByOrder;
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
      const items = page.map((order) => orderRowToRecord(order, linesByOrder.get(order.id) ?? []));
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
      return orderRowToRecord(order, linesByOrder.get(order.id) ?? []);
    },
  };
}
