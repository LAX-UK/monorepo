import { isIndexableObject } from "@/lib/data/http/object-guards";

/**
 * What the sale list says about the results of a sale that has ended: still finalising, or the
 * final figures. Mirrors the API's results summary.
 */
export type SaleResultsSummaryView =
  | { state: "finalising"; pendingLotCount: number }
  | {
      state: "final";
      lotCount: number;
      soldCount: number;
      currency: string;
      /** Hammer plus buyer's premium over every sold lot, as a decimal string. */
      totalWithPremium: string;
      endedAt: string;
    };

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Read the summary from a sale list row; anything malformed is treated as no summary. */
export function parseSaleResultsSummary(raw: unknown): SaleResultsSummaryView | undefined {
  if (!isIndexableObject(raw)) return undefined;
  if (raw.state === "finalising") {
    return { state: "finalising", pendingLotCount: count(raw.pendingLotCount) ?? 0 };
  }
  if (raw.state !== "final") return undefined;
  const lotCount = count(raw.lotCount);
  const soldCount = count(raw.soldCount);
  if (
    lotCount === null ||
    soldCount === null ||
    typeof raw.currency !== "string" ||
    typeof raw.totalWithPremium !== "string" ||
    typeof raw.endedAt !== "string"
  ) {
    return undefined;
  }
  return {
    state: "final",
    lotCount,
    soldCount,
    currency: raw.currency,
    totalWithPremium: raw.totalWithPremium,
    endedAt: raw.endedAt,
  };
}
