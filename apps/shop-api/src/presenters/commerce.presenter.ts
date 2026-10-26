import type { BasketView, CheckoutSession, OrderSummary } from "@auction/shop-contracts";
import {
  basketLineMaxQuantity,
  carrierTrackingUrl,
  computeMerchandiseSubtotal,
  orderProblemWindow,
  pence,
} from "@auction/shop-domain";
import { orderRecordVat } from "../application/order-vat.js";
import type {
  BasketRecord,
  CheckoutOrderResult,
  OrderRecord,
} from "../application/ports/commerce.ports.js";

export function presentBasket(
  record: BasketRecord,
  options: { editionOrderLimit: number | null },
): BasketView {
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
      productVariantId: line.productVariantId,
      productSlug: line.productSlug,
      productTitle: line.productTitle,
      variantSku: line.variantSku,
      unitPricePence: line.unitPricePence,
      quantity: line.quantity,
      soldOut: line.sellableCount < 1,
      priceChanged: line.livePricePence !== null && line.livePricePence !== line.unitPricePence,
      outOfStock: line.quantity > line.sellableCount,
      imageUrl: line.imageUrl,
      artistName: line.artistName,
      artistSlug: line.artistSlug,
      editionSize: line.editionSize,
      orderLimit: line.artworkId ? options.editionOrderLimit : null,
      maxQuantity: basketLineMaxQuantity({
        orderLimit: line.artworkId ? options.editionOrderLimit : null,
        sellableCount: line.sellableCount,
      }),
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

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

export function presentOrder(record: OrderRecord, now: Date = new Date()): OrderSummary {
  const vat = orderRecordVat(record);
  const window = orderProblemWindow({
    status: record.status,
    paidAt: record.paidAt,
    refundPeriodEndsAt: record.refundPeriodEndsAt,
    possessionAt: record.progress?.possessionAt ?? null,
    now,
  });
  const progress = record.progress;
  return {
    orderId: record.orderId,
    reference: record.reference,
    status: record.status,
    fulfilment: record.fulfilment,
    merchandiseSubtotalPence: record.merchandiseSubtotalPence,
    fulfilmentSurchargePence: record.fulfilmentSurchargePence,
    totalPence: record.totalPence,
    refundedPence: record.refundedPence,
    createdAt: record.createdAt.toISOString(),
    paidAt: iso(record.paidAt),
    checkoutExpiresAt: record.status === "pending_payment" ? iso(record.checkoutExpiresAt) : null,
    vatIncludedPence: vat ? vat.vatPence : null,
    vatRateBp: vat?.rateBp ?? null,
    deliveryAddress: record.deliveryAddress
      ? {
          ...(record.deliveryAddress.recipientName
            ? { recipientName: record.deliveryAddress.recipientName }
            : {}),
          line1: record.deliveryAddress.line1,
          ...(record.deliveryAddress.line2 ? { line2: record.deliveryAddress.line2 } : {}),
          city: record.deliveryAddress.city,
          postcode: record.deliveryAddress.postcode,
          country: record.deliveryAddress.country,
        }
      : null,
    progress: progress
      ? {
          status: progress.status,
          carrier: progress.carrier,
          trackingNumber: progress.trackingNumber,
          trackingUrl: carrierTrackingUrl(progress.carrier, progress.trackingNumber),
          productionStartedAt: iso(progress.productionStartedAt),
          dispatchedAt: iso(progress.dispatchedAt),
          readyForCollectionAt: iso(progress.readyForCollectionAt),
          possessionAt: iso(progress.possessionAt),
          cancelledAt: iso(progress.cancelledAt),
        }
      : null,
    refunds: record.refunds.map((refund) => ({
      amountPence: refund.amountPence,
      kind: refund.source === "cancellation" ? "cancellation" : "refund",
      status: refund.status,
      requestedAt: refund.requestedAt.toISOString(),
      refundedAt: iso(refund.refundedAt),
    })),
    problemReport: { open: window.open, endsAt: iso(window.endsAt) },
    invoiceAvailable: record.paidAt !== null,
    lines: record.lines.map((line) => ({
      orderLineId: line.orderLineId,
      artworkSlug: line.artworkSlug,
      artworkTitle: line.artworkTitle,
      productVariantId: line.productVariantId,
      productSlug: line.productSlug,
      productTitle: line.productTitle,
      variantSku: line.variantSku,
      editionNumber: line.editionNumber,
      editionSize: line.editionSize,
      artistName: line.artistName,
      unitPricePence: line.unitPricePence,
      imageUrl: line.imageUrl,
    })),
  };
}
