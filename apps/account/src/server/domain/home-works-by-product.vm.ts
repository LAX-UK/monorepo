import { type LaxPortfolioItemV1, type LaxProductId, buildHoldings } from "@auction/lax-ecosystem";
import { PRODUCT_LABELS } from "./portfolio-labels";

/** The chart is a comparison, so it needs at least this many products that hold works. */
export const MIN_PRODUCTS_FOR_CHART = 2;

const FAMILY_ORDER: readonly LaxProductId[] = ["art", "shop", "bid"];

export type WorksBarVm =
  | {
      product: LaxProductId;
      label: string;
      status: "counted";
      count: number;
      widthPercent: number;
    }
  | { product: LaxProductId; label: string; status: "unanswered" };

export type WorksByProductVm = { bars: WorksBarVm[] };

/**
 * Works by product for the Home collection card, ranked by count with empty products last.
 * Hidden (null) when fewer than two products hold works, because one bar compares nothing. A
 * product that did not answer keeps its place at the end and never gets a made-up count.
 */
export function buildWorksByProduct(
  items: readonly LaxPortfolioItemV1[],
  unanswered: readonly LaxProductId[] = [],
): WorksByProductVm | null {
  const counted = new Map<string, number>(
    buildHoldings(items).allocation.byProduct.map((entry) => [entry.label, entry.count]),
  );
  const answered = FAMILY_ORDER.filter((product) => !unanswered.includes(product)).map(
    (product) => ({ product, count: counted.get(product) ?? 0 }),
  );
  if (answered.filter((entry) => entry.count > 0).length < MIN_PRODUCTS_FOR_CHART) return null;
  const largest = Math.max(...answered.map((entry) => entry.count));
  const ranked = [...answered].sort((a, b) => b.count - a.count);
  return {
    bars: [
      ...ranked.map(
        ({ product, count }): WorksBarVm => ({
          product,
          label: PRODUCT_LABELS[product],
          status: "counted",
          count,
          widthPercent: (count / largest) * 100,
        }),
      ),
      ...FAMILY_ORDER.filter((product) => unanswered.includes(product)).map(
        (product): WorksBarVm => ({
          product,
          label: PRODUCT_LABELS[product],
          status: "unanswered",
        }),
      ),
    ],
  };
}
