import type {
  LaxPortfolioItemStatus,
  LaxPortfolioItemV1,
  LaxProductId,
} from "@auction/lax-ecosystem";
import { countWorksByProduct } from "./works-by-product.vm";

/** What a product card says about the person's own works there. */
export type ProductSummaryVm =
  | { status: "counted"; line: string }
  | { status: "empty" }
  | { status: "unanswered" };

export type ProductSummariesVm = Readonly<Record<LaxProductId, ProductSummaryVm>>;

const FAMILY_ORDER: readonly LaxProductId[] = ["art", "shop", "bid"];

/** What a product calls what it sells: LAX Shop sells editions, the others sell works. */
const NOUNS: Readonly<Record<LaxProductId, { one: string; many: string }>> = {
  art: { one: "work", many: "works" },
  shop: { one: "edition", many: "editions" },
  bid: { one: "work", many: "works" },
};

/** The statuses worth a mention beside the total, in the order they read. */
const NOTABLE_STATUSES: ReadonlyArray<{ status: LaxPortfolioItemStatus; phrase: string }> = [
  { status: "awaiting_payment", phrase: "to pay" },
  { status: "awaiting_shipment", phrase: "on its way" },
  { status: "consigned", phrase: "consigned" },
  { status: "in_sale", phrase: "in a sale" },
];

function describeProduct(
  product: LaxProductId,
  total: number,
  items: readonly LaxPortfolioItemV1[],
): ProductSummaryVm {
  if (total === 0) return { status: "empty" };
  const noun = NOUNS[product];
  const notable = NOTABLE_STATUSES.flatMap(({ status, phrase }) => {
    const count = items.filter((item) => item.status === status).length;
    return count > 0 ? [`${count} ${phrase}`] : [];
  });
  return {
    status: "counted",
    line: [`${total} ${total === 1 ? noun.one : noun.many}`, ...notable].join(" · "),
  };
}

/**
 * One line per product for the Home cards, from the works Home already loaded (the same count
 * the works-by-product chart reads). A product that did not answer is never given a count.
 */
export function buildProductSummaries(
  items: readonly LaxPortfolioItemV1[],
  unanswered: readonly LaxProductId[] = [],
): ProductSummariesVm {
  const counted = countWorksByProduct(items);
  return Object.fromEntries(
    FAMILY_ORDER.map((product): [LaxProductId, ProductSummaryVm] => [
      product,
      unanswered.includes(product)
        ? { status: "unanswered" }
        : describeProduct(
            product,
            counted.get(product) ?? 0,
            items.filter((item) => item.product === product),
          ),
    ]),
  ) as ProductSummariesVm;
}

/** Every product unanswered, for when nothing could be read at all. */
export function unansweredSummaries(): ProductSummariesVm {
  return buildProductSummaries([], FAMILY_ORDER);
}
