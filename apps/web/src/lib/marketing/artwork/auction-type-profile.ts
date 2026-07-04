import { type LotAuctionType, lotAuctionTypes } from "@auction/types";

export type ArtworkMinButtonLabel = "min" | "accept";

/** Presentation rules for artwork / bid UI by lot auction type (OCP registry). */
export type ArtworkAuctionTypeProfile = {
  auctionType: LotAuctionType;
  label: string;
  showLiveBidFeed: boolean;
  showUserBidsHistory: boolean;
  showAutoBidPanel: boolean;
  showIncrementChips: boolean;
  showMaxAutoField: boolean;
  minButtonLabel: ArtworkMinButtonLabel;
};

function buildProfile(auctionType: LotAuctionType): ArtworkAuctionTypeProfile {
  switch (auctionType) {
    case "english":
      return {
        auctionType,
        label: "English auction",
        showLiveBidFeed: true,
        showUserBidsHistory: true,
        showAutoBidPanel: true,
        showIncrementChips: true,
        showMaxAutoField: true,
        minButtonLabel: "min",
      };
    case "buy_it_now":
      return {
        auctionType,
        label: "Buy it now",
        showLiveBidFeed: true,
        showUserBidsHistory: true,
        showAutoBidPanel: true,
        showIncrementChips: true,
        showMaxAutoField: true,
        minButtonLabel: "min",
      };
    case "dutch":
      return {
        auctionType,
        label: "Dutch auction",
        showLiveBidFeed: true,
        showUserBidsHistory: true,
        showAutoBidPanel: false,
        showIncrementChips: false,
        showMaxAutoField: false,
        minButtonLabel: "accept",
      };
    case "sealed":
      return {
        auctionType,
        label: "Sealed bid",
        showLiveBidFeed: false,
        showUserBidsHistory: true,
        showAutoBidPanel: false,
        showIncrementChips: false,
        showMaxAutoField: false,
        minButtonLabel: "min",
      };
    default: {
      const _exhaustive: never = auctionType;
      return _exhaustive;
    }
  }
}

const profiles = Object.fromEntries(lotAuctionTypes.map((t) => [t, buildProfile(t)])) as Record<
  LotAuctionType,
  ArtworkAuctionTypeProfile
>;

const profileCache = new Map<LotAuctionType, ArtworkAuctionTypeProfile>(
  lotAuctionTypes.map((t) => [t, profiles[t]]),
);

/** Stable registry keyed by auction type — extend here when adding new types. */
export const ARTWORK_AUCTION_TYPE_PROFILES: Record<LotAuctionType, ArtworkAuctionTypeProfile> =
  profiles;

export function getArtworkAuctionTypeProfile(
  auctionType: LotAuctionType,
): ArtworkAuctionTypeProfile {
  return profileCache.get(auctionType) ?? buildProfile(auctionType);
}
