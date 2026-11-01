import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";

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

/** One row per lifecycle: the live words only while bidding is open. */
const PRICE_LABEL: Record<LotLifecycleKind, LotPriceLabel> = {
  preLaunch: { label: "Starting bid", value: AMOUNT },
  scheduled: { label: "Starting bid", value: AMOUNT },
  live: { label: "Current bid", value: AMOUNT },
  extended: { label: "Current bid", value: AMOUNT },
  liveSaleroom: { label: "Current bid", value: AMOUNT },
  saleroomPaused: { label: "Current bid", value: AMOUNT },
  endedSold: { label: "Hammer price", value: AMOUNT },
  endedNoSale: { label: "Result", value: { kind: "text", text: "Not sold" } },
  cancelled: { label: "Result", value: { kind: "text", text: "Cancelled" } },
  withdrawn: { label: "Result", value: { kind: "text", text: "Withdrawn" } },
};

export function lotPriceLabel(kind: LotLifecycleKind): LotPriceLabel {
  return PRICE_LABEL[kind];
}

/** Lifecycles in which bidding is over: no next bid, no live feed. */
export function lotLifecycleIsClosed(kind: LotLifecycleKind): boolean {
  return (
    kind === "endedSold" || kind === "endedNoSale" || kind === "cancelled" || kind === "withdrawn"
  );
}
