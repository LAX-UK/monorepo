import type { LotLifecycleKind } from "@auction/domain";

export type LotSections = {
  /** Watch and share sit under the price block. */
  watchShare: boolean;
  /** The bid history disclosure. */
  history: boolean;
};

const NOTHING: LotSections = { watchShare: false, history: false };

/**
 * Which secondary parts a lot shows in each moment of its life. A withdrawn lot keeps its page
 * but hides everything about the sale; an upcoming one has no bids to show a history of yet.
 */
export const LOT_SECTIONS: Readonly<Record<LotLifecycleKind, LotSections>> = {
  preLaunch: { watchShare: true, history: false },
  scheduled: { watchShare: true, history: false },
  live: { watchShare: true, history: true },
  extended: { watchShare: true, history: true },
  liveSaleroom: { watchShare: true, history: true },
  saleroomPaused: { watchShare: true, history: true },
  endedSold: { watchShare: true, history: true },
  endedNoSale: { watchShare: true, history: true },
  cancelled: NOTHING,
  withdrawn: NOTHING,
};
