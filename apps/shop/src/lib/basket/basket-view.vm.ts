import type { BasketLine, BasketView } from "@auction/shop-contracts";
import {
  FULFILMENT_SURCHARGE_PENCE,
  SHOP_BASKET_LINE_QUANTITY_MAX,
  SHOP_EDITION_ORDER_LIMIT,
} from "@auction/shop-domain";
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
  /** "Limit 2 per order" for editions: a rule, so it never reveals how many are left. */
  limitHint: string | null;
  kind: "edition" | "merchandise";
  /** What to send to put the line back after Remove. */
  restore:
    | { kind: "edition"; artworkSlug: string }
    | { kind: "merchandise"; variantId: string }
    | null;
};

export function basketLineMaxQuantity(line: BasketLine): number {
  if (line.maxQuantity !== undefined) return line.maxQuantity;
  // An older shop-api: fall back to the rule, so the stepper still cannot run away.
  return line.productVariantId ? SHOP_BASKET_LINE_QUANTITY_MAX : SHOP_EDITION_ORDER_LIMIT;
}

export function presentBasketLine(line: BasketLine): BasketLineVm {
  const kind = line.productVariantId ? "merchandise" : "edition";
  const title = line.productTitle ?? line.artworkTitle ?? "Item";
  const artistName = line.artistName ?? null;
  const editionSize = line.editionSize ?? null;
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
    maxQuantity: basketLineMaxQuantity(line),
    limitHint: kind === "edition" ? `Limit ${SHOP_EDITION_ORDER_LIMIT} per order` : null,
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
  total: string;
  vatNote: string;
};

/**
 * The basket's full cost for the default choice, UK insured delivery, using the same surcharge
 * checkout charges, so the total here is the total at checkout.
 */
export function presentBasketSummary(
  basket: Pick<BasketView, "lines" | "merchandiseSubtotalPence">,
): BasketSummaryVm {
  const items = basket.lines.reduce((total, line) => total + line.quantity, 0);
  const deliveryPence = FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery;
  const collection = Math.min(
    FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish,
    FULFILMENT_SURCHARGE_PENCE.collect_brunswick,
  );
  return {
    itemCountLabel: items === 1 ? "Subtotal (1 item)" : `Subtotal (${items} items)`,
    subtotal: formatGbpPence(basket.merchandiseSubtotalPence),
    deliveryLabel: "UK insured delivery",
    delivery: formatGbpPence(deliveryPence),
    deliveryNote:
      collection === 0
        ? "Collection in London is free. Choose it at checkout."
        : `Collection in London from ${formatGbpPence(collection)}. Choose it at checkout.`,
    total: formatGbpPence(basket.merchandiseSubtotalPence + deliveryPence),
    vatNote: "Prices include VAT",
  };
}
