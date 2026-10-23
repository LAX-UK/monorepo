import {
  PORTFOLIO_SOURCES,
  PORTFOLIO_SOURCE_DESCRIPTORS,
  type PortfolioSourceId,
  type SourceResults,
} from "./portfolio-sources";

export type ComposedRows<Row> = {
  /** Rows from every source that answered, in source order. */
  rows: Row[];
  /** Sources that could not answer. Their rows are missing, not zero. */
  unavailable: PortfolioSourceId[];
  /** Sources that answered but deliberately left part of their data out. */
  partial: PortfolioSourceId[];
  /** True only when every source answered in full, so counts and totals are the whole picture. */
  complete: boolean;
};

export function composeSources<Row>(results: SourceResults<Row>): ComposedRows<Row> {
  const rows: Row[] = [];
  const unavailable: PortfolioSourceId[] = [];
  const partial: PortfolioSourceId[] = [];
  for (const source of PORTFOLIO_SOURCES) {
    const result = results[source];
    if (result.status === "unavailable") {
      unavailable.push(source);
      continue;
    }
    rows.push(...result.rows);
    if (result.partial) partial.push(source);
  }
  return {
    rows,
    unavailable,
    partial,
    complete: unavailable.length === 0 && partial.length === 0,
  };
}

export type SourceNoticeVm = { id: string; text: string };

type Subject = "items" | "money";

const NOUNS: Record<Subject, string> = { items: "items", money: "money details" };

/**
 * Plain-language notes for a page built from incomplete data. They name the product, and say
 * that the figures leave it out, so a partial set is never read as the whole portfolio.
 */
export function buildSourceNotices(
  composed: Pick<ComposedRows<unknown>, "unavailable" | "partial">,
  subject: Subject,
): SourceNoticeVm[] {
  const noun = NOUNS[subject];
  return [
    ...composed.unavailable.map((source) => ({
      id: `unavailable-${source}`,
      text: `${PORTFOLIO_SOURCE_DESCRIPTORS[source].label} ${noun} are unavailable right now. Counts and totals on this page leave them out.`,
    })),
    ...composed.partial.map((source) => ({
      id: `partial-${source}`,
      text: `Some ${PORTFOLIO_SOURCE_DESCRIPTORS[source].label} ${noun} are not shown yet, so this may not be everything.`,
    })),
  ];
}
