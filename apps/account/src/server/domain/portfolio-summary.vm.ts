import { type LaxPortfolioItemV1, buildPortfolioHeader } from "@auction/lax-ecosystem";
import type { ComposedRows } from "./portfolio-composition";
import { PORTFOLIO_SOURCES } from "./portfolio-sources";

export type PortfolioSummaryVm =
  | { kind: "counts"; counts: string[]; incompleteNote: string | null }
  | { kind: "empty" }
  | { kind: "unavailable" };

const INCOMPLETE_NOTE = "Some products did not answer, so these counts may be low.";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The overview card's one-line summary. Zero counts are left out, and an incomplete load is
 * flagged rather than shown as the whole picture. A new collector is only recognised when every
 * product answered, since a product that did not answer may be holding their works.
 */
export function buildPortfolioSummary(
  composed: Pick<ComposedRows<LaxPortfolioItemV1>, "rows" | "complete" | "unavailable">,
): PortfolioSummaryVm {
  if (composed.unavailable.length >= PORTFOLIO_SOURCES.length) return { kind: "unavailable" };
  if (composed.rows.length === 0) {
    return composed.complete ? { kind: "empty" } : { kind: "unavailable" };
  }
  const header = buildPortfolioHeader(composed.rows);
  const counts = [
    header.worksOwned > 0 ? plural(header.worksOwned, "work owned", "works owned") : null,
    header.inSaleOrConsigned > 0 ? `${header.inSaleOrConsigned} in sale or consigned` : null,
    header.awaitingPayment > 0 ? `${header.awaitingPayment} awaiting payment` : null,
  ].filter((count): count is string => count !== null);
  return {
    kind: "counts",
    counts: counts.length > 0 ? counts : [plural(composed.rows.length, "work", "works")],
    incompleteNote: composed.complete ? null : INCOMPLETE_NOTE,
  };
}
