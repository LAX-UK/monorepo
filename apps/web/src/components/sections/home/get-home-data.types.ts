import type {
  EditorsPickLotCardVM,
  HomeUpcomingAuctionTileVM,
  LotCardVM,
} from "@/components/sections/home/home-view-models";
import type { HomeHangVM } from "@/lib/hang/home-hang";
import type { HomeCover } from "@/lib/marketing-cover/home-cover";
import type { HomeStateResult } from "@auction/domain";
import type { Sale } from "@auction/types";

/** Minimal shape for `itemList` JSON-LD when there are no upcoming-auction tiles. */
export type HomeJsonLdListEntry = { title: string; href: string };

export type HomeUrgencySection =
  | { variant: "endingSoon"; lots: LotCardVM[] }
  | { variant: "liveNow"; lots: LotCardVM[] }
  | { variant: "upcoming"; lots: LotCardVM[] }
  | { variant: "none"; lots: LotCardVM[] };

export type HomePageData = {
  /** Which content state the page is in, with its section order and lead sale. */
  homeState: HomeStateResult;
  /** The works hung under the hero; `null` when fewer than two have photographs. */
  hang: HomeHangVM | null;
  /** The cover slides, built for a visitor who is not signed in. */
  cover: HomeCover;
  /** Lots promoted for structured data when `upcomingAuctionTiles` is empty. */
  jsonLdListFallback: HomeJsonLdListEntry[];
  urgencySection: HomeUrgencySection;
  upcomingAuctionTiles: HomeUpcomingAuctionTileVM[];
  /** First N sales backing `upcomingAuctionTiles` (for Event-rich JSON-LD). */
  upcomingSales: Sale[];
  /** Lots not shown elsewhere on the page; empty when too few remain to fill a strip. */
  moreLots: EditorsPickLotCardVM[];
  isAuthenticated: boolean;
  /** Lot IDs on the signed-in user’s watchlist (empty when logged out). */
  watchedLotIds: string[];
};
