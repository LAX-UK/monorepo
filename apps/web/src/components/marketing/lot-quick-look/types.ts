import type { LotStatus } from "@auction/types";

/** Minimal lot preview contract for the quick-look modal (card-agnostic). */
export type LotQuickLookVM = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  imageAlt: string;
  status: LotStatus;
  startTime?: string;
  endTime?: string;
  lotLabel?: string | null;
  estimateLabel?: string;
  estimateValue?: string;
  currentBidLabel?: string;
  currentBidValue?: string;
  medium?: string | null;
  images?: string[];
  dimensions?: string | null;
  minNextBidLabel?: string;
  minNextBidValue?: string;
  buyersPremiumHint?: string;
};

export type LotQuickLookOpenOptions = {
  deck?: LotQuickLookVM[];
  deckIndex?: number;
  /** Context label e.g. "More from this sale" */
  deckSourceLabel?: string;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath?: string;
};

export type LotQuickLookSession = {
  vm: LotQuickLookVM;
  options: LotQuickLookOpenOptions;
  deckIndex: number;
};

export function isLotQuickLookBiddable(status: LotStatus): boolean {
  return status === "active";
}
