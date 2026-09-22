import type { BasketView, CheckoutSession, OrderSummary } from "@auction/shop-contracts";
import { computeMerchandiseSubtotal, pence } from "@auction/shop-domain";
import type {
  BasketRecord,
  CheckoutOrderResult,
  OrderRecord,
} from "../application/ports/commerce.ports.js";

export function presentBasket(record: BasketRecord): BasketView {
  const merchandiseSubtotalPence = computeMerchandiseSubtotal(
    record.lines.map((line) => ({
      unitPricePence: pence(line.unitPricePence),
      quantity: line.quantity,
    })),
  );
  return {
    basketId: record.basketId,
    expiresAt: record.expiresAt.toISOString(),
    merchandiseSubtotalPence,
    lines: record.lines.map((line) => ({
      lineId: line.lineId,
      artworkSlug: line.artworkSlug,
      artworkTitle: line.artworkTitle,
      unitPricePence: line.unitPricePence,
      quantity: line.quantity,
      sellableCount: line.sellableCount,
      priceChanged: line.livePricePence !== null && line.livePricePence !== line.unitPricePence,
      outOfStock: line.quantity > line.sellableCount,
    })),
  };
}

export function presentCheckoutSession(result: CheckoutOrderResult): CheckoutSession {
  return {
    orderId: result.orderId,
    checkoutUrl: result.checkoutUrl,
    expiresAt: result.expiresAt.toISOString(),
  };
}

export function presentOrder(record: OrderRecord): OrderSummary {
  return {
    orderId: record.orderId,
    status: record.status,
    fulfilment: record.fulfilment,
    merchandiseSubtotalPence: record.merchandiseSubtotalPence,
    fulfilmentSurchargePence: record.fulfilmentSurchargePence,
    totalPence: record.totalPence,
    createdAt: record.createdAt.toISOString(),
    paidAt: record.paidAt ? record.paidAt.toISOString() : null,
    deliveryAddress: record.deliveryAddress
      ? {
          line1: record.deliveryAddress.line1,
          ...(record.deliveryAddress.line2 ? { line2: record.deliveryAddress.line2 } : {}),
          city: record.deliveryAddress.city,
          postcode: record.deliveryAddress.postcode,
          country: record.deliveryAddress.country,
        }
      : null,
    lines: record.lines.map((line) => ({
      orderLineId: line.orderLineId,
      artworkSlug: line.artworkSlug,
      artworkTitle: line.artworkTitle,
      editionNumber: line.editionNumber,
      unitPricePence: line.unitPricePence,
    })),
  };
}
