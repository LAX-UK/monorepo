import type {
  EditorsPickLotCardVM,
  HeroStateVM,
  HomeUpcomingAuctionTileVM,
  LotCardVM,
  PrivateSaleHighlightVM,
} from "@/components/sections/home/home-view-models";
import type { Sale } from "@auction/types";

/** Minimal shape for `itemList` JSON-LD when there are no upcoming-auction tiles. */
export type HomeJsonLdListEntry = { title: string; href: string };

export type HomeUrgencySection =
  | { variant: "endingSoon"; lots: LotCardVM[] }
  | { variant: "liveNow"; lots: LotCardVM[] }
  | { variant: "upcoming"; lots: LotCardVM[] }
  | { variant: "none"; lots: LotCardVM[] };

export type HomePageData = {
  heroState: HeroStateVM;
  /** Lots promoted for structured data when `upcomingAuctionTiles` is empty. */
  jsonLdListFallback: HomeJsonLdListEntry[];
  urgencySection: HomeUrgencySection;
  upcomingAuctionTiles: HomeUpcomingAuctionTileVM[];
  /** First N sales backing `upcomingAuctionTiles` (for Event-rich JSON-LD). */
  upcomingSales: Sale[];
  editorsPickLots: EditorsPickLotCardVM[];
  privateSaleHighlights: PrivateSaleHighlightVM[];
  isAuthenticated: boolean;
  /** Lot IDs on the signed-in user’s watchlist (empty when logged out). */
  watchedLotIds: string[];
};

export type { HeroStateVM };
