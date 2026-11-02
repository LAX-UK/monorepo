import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";
import { lotHeadlineLabel } from "@auction/domain";

/** How the price figure of a lot reads in one lifecycle. */
export type LotPriceLabel = {
  label: string;
  /**
   * The money figure, or a word in place of it when the lot has no price to report
   * ("Not sold"): an unsold lot's last bid is not a result.
   */
  value: { kind: "amount" } | { kind: "text"; text: string };
};

const AMOUNT = { kind: "amount" } as const;

/** The catalogue's own words for the lifecycles where a lot is not open for bids. */
const CLOSED_PRICE_LABEL: Partial<Record<LotLifecycleKind, LotPriceLabel>> = {
  endedSold: { label: "Hammer price", value: AMOUNT },
  endedNoSale: { label: "Result", value: { kind: "text", text: "Not sold" } },
  cancelled: { label: "Result", value: { kind: "text", text: "Cancelled" } },
  withdrawn: { label: "Result", value: { kind: "text", text: "Withdrawn" } },
};

/** The price label for a lifecycle; `hasBids` picks "Starting bid" or "Current bid" while open. */
export function lotPriceLabel(kind: LotLifecycleKind, hasBids: boolean): LotPriceLabel {
  const closed = CLOSED_PRICE_LABEL[kind];
  if (closed) return closed;
  return { label: lotHeadlineLabel(kind, hasBids), value: AMOUNT };
}

/** Lifecycles in which bidding is over: no next bid, no live feed. */
export function lotLifecycleIsClosed(kind: LotLifecycleKind): boolean {
  return (
    kind === "endedSold" || kind === "endedNoSale" || kind === "cancelled" || kind === "withdrawn"
  );
}
