import { lotAuctionTypes } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  ARTWORK_AUCTION_TYPE_PROFILES,
  getArtworkAuctionTypeProfile,
} from "./auction-type-profile";

describe("ARTWORK_AUCTION_TYPE_PROFILES registry", () => {
  it("covers every LotAuctionType", () => {
    for (const auctionType of lotAuctionTypes) {
      expect(ARTWORK_AUCTION_TYPE_PROFILES[auctionType].auctionType).toBe(auctionType);
    }
  });

  it("getArtworkAuctionTypeProfile returns the registry entry", () => {
    for (const auctionType of lotAuctionTypes) {
      expect(getArtworkAuctionTypeProfile(auctionType)).toBe(
        ARTWORK_AUCTION_TYPE_PROFILES[auctionType],
      );
    }
  });

  it("sealed bid hides the public live feed but keeps user bid history", () => {
    const sealed = getArtworkAuctionTypeProfile("sealed");
    expect(sealed.showLiveBidFeed).toBe(false);
    expect(sealed.showUserBidsHistory).toBe(true);
    expect(sealed.showAutoBidPanel).toBe(false);
  });

  it("english and buy_it_now enable auto-bid and increment chips", () => {
    for (const auctionType of ["english", "buy_it_now"] as const) {
      const profile = getArtworkAuctionTypeProfile(auctionType);
      expect(profile.showAutoBidPanel).toBe(true);
      expect(profile.showIncrementChips).toBe(true);
      expect(profile.showMaxAutoField).toBe(true);
    }
  });

  it("dutch uses accept min-button label and disables auto-bid UI", () => {
    const dutch = getArtworkAuctionTypeProfile("dutch");
    expect(dutch.minButtonLabel).toBe("accept");
    expect(dutch.showAutoBidPanel).toBe(false);
    expect(dutch.showIncrementChips).toBe(false);
  });
});
