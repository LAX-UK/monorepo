import { checkoutDeliverySummaryRow } from "@/lib/checkout/checkout-delivery";
import type { BasketLine, ShopFulfilmentOption } from "@auction/shop-contracts";
import { FULFILMENT_SURCHARGE_PENCE, SHOP_BASKET_LINE_QUANTITY_MAX } from "@auction/shop-domain";
import { formatGbpPence } from "@auction/shop-portal/vm";

export type BasketLineVm = {
  lineId: string;
  title: string;
  href: string | null;
  artistName: string | null;
  artistHref: string | null;
  /** "Limited edition of 24", or the SKU for merchandise; null when neither is known. */
  detail: string | null;
  imageUrl: string | null;
  imageAlt: string;
  unitPrice: string;
  unitPricePence: number;
  quantity: number;
  /** The stepper's ceiling. It can sit below the stated rule, but is never shown as a number. */
  maxQuantity: number;
  /** "Limit 2 per order" when an order limit applies: a rule, so it reveals no stock. */
  limitHint: string | null;
  /** True when the ceiling is below the order limit, because fewer can be ordered now. */
  cappedByAvailability: boolean;
  kind: "edition" | "merchandise";
  /** What to send to put the line back after Remove. */
  restore:
    | { kind: "edition"; artworkSlug: string }
    | { kind: "merchandise"; variantId: string }
    | null;
};

export function basketLineMaxQuantity(line: BasketLine): number {
  // An older shop-api sends no ceiling; the server still refuses what it cannot supply.
  return line.maxQuantity ?? SHOP_BASKET_LINE_QUANTITY_MAX;
}

/**
 * What the stepper says under itself. At a ceiling set by availability rather than the order
 * limit it gives the reason the plus button stopped, without a count of what is left.
 */
export function basketLineStepperHint(vm: BasketLineVm, quantity: number): string | null {
  if (vm.cappedByAvailability && quantity >= vm.maxQuantity) return "No more available to order";
  return vm.limitHint;
}

export function presentBasketLine(line: BasketLine): BasketLineVm {
  const kind = line.productVariantId ? "merchandise" : "edition";
  const title = line.productTitle ?? line.artworkTitle ?? "Item";
  const artistName = line.artistName ?? null;
  const editionSize = line.editionSize ?? null;
  const orderLimit = line.orderLimit ?? null;
  const maxQuantity = basketLineMaxQuantity(line);
  return {
    lineId: line.lineId,
    title,
    href: line.productSlug
      ? `/merchandise/${line.productSlug}`
      : line.artworkSlug
        ? `/artworks/${line.artworkSlug}`
        : null,
    artistName,
    artistHref: line.artistSlug ? `/artists/${line.artistSlug}` : null,
    detail:
      kind === "edition"
        ? editionSize
          ? `Limited edition of ${editionSize}`
          : null
        : line.variantSku
          ? `SKU ${line.variantSku}`
          : null,
    imageUrl: line.imageUrl,
    imageAlt: artistName ? `${title} by ${artistName}` : title,
    unitPrice: formatGbpPence(line.unitPricePence),
    unitPricePence: line.unitPricePence,
    quantity: line.quantity,
    maxQuantity,
    limitHint: orderLimit ? `Limit ${orderLimit} per order` : null,
    cappedByAvailability: maxQuantity < (orderLimit ?? SHOP_BASKET_LINE_QUANTITY_MAX),
    kind,
    restore: line.productVariantId
      ? { kind: "merchandise", variantId: line.productVariantId }
      : line.artworkSlug
        ? { kind: "edition", artworkSlug: line.artworkSlug }
        : null,
  };
}

export type BasketSummaryVm = {
  itemCountLabel: string;
  subtotal: string;
  deliveryLabel: string;
  delivery: string;
  /** Collection is offered at checkout; say so before the shopper gets there. */
  deliveryNote: string;
  /** "Total", or "Total before delivery" where delivery cannot be priced online. */
  totalLabel: string;
  total: string;
  vatNote: string;
};

/**
 * The order's full cost: the basket shows it for the default choice, UK insured delivery, and
 * checkout for the choice made. Both use this one calculation and the surcharge shop-api
 * charges, so the total in the basket is the total at checkout.
 */
export function presentBasketSummary(
  lines: ReadonlyArray<Pick<BasketLine, "unitPricePence" | "quantity">>,
  fulfilment: ShopFulfilmentOption = "uk_insured_delivery",
): BasketSummaryVm {
  const items = lines.reduce((total, line) => total + line.quantity, 0);
  // The sum of the line totals, as shop-api computes it.
  const subtotalPence = lines.reduce(
    (total, line) => total + line.unitPricePence * line.quantity,
    0,
  );
  const delivery = checkoutDeliverySummaryRow(fulfilment);
  const collection = FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish;
  return {
    itemCountLabel: items === 1 ? "Subtotal (1 item)" : `Subtotal (${items} items)`,
    subtotal: formatGbpPence(subtotalPence),
    deliveryLabel: delivery.label,
    delivery: delivery.value,
    deliveryNote:
      collection === 0
        ? "Collection in London is free. Choose it at checkout."
        : `Collection in London is ${formatGbpPence(collection)}. Choose it at checkout.`,
    totalLabel: fulfilment === "international_quotation" ? "Total before delivery" : "Total",
    total: formatGbpPence(subtotalPence + delivery.pence),
    vatNote: "Prices include VAT",
  };
}
