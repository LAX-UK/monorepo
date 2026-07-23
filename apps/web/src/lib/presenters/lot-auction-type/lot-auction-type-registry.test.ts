import { lotAuctionTypes } from "@auction/types";
import { describe, expect, it } from "vitest";
import { LOT_AUCTION_TYPE_REGISTRY, lotAuctionTypeLabel } from "./lot-auction-type-registry";
import { resolveLotAuctionTypePresentation } from "./resolve-lot-auction-type";

describe("lot-auction-type registry", () => {
  it("maps all auction types to staff labels and tag keys", () => {
    expect(LOT_AUCTION_TYPE_REGISTRY.english).toEqual({ label: "English", mode: "english" });
    expect(LOT_AUCTION_TYPE_REGISTRY.dutch).toEqual({ label: "Dutch", mode: "dutch" });
    expect(LOT_AUCTION_TYPE_REGISTRY.sealed).toEqual({
      label: "Sealed bid",
      mode: "sealed",
    });
    expect(LOT_AUCTION_TYPE_REGISTRY.buy_it_now).toEqual({
      label: "Buy it now",
      mode: "buy_it_now",
    });
  });

  it("covers every LotAuctionType from domain (OCP guard)", () => {
    for (const type of lotAuctionTypes) {
      expect(LOT_AUCTION_TYPE_REGISTRY[type]).toBeDefined();
      expect(LOT_AUCTION_TYPE_REGISTRY[type].label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(LOT_AUCTION_TYPE_REGISTRY)).toHaveLength(lotAuctionTypes.length);
  });

  it("lotAuctionTypeLabel delegates to registry", () => {
    expect(lotAuctionTypeLabel("english")).toBe("English");
    expect(lotAuctionTypeLabel("buy_it_now")).toBe("Buy it now");
  });

  it("resolveLotAuctionTypePresentation returns registry entry", () => {
    expect(resolveLotAuctionTypePresentation("sealed")).toEqual({
      label: "Sealed bid",
      mode: "sealed",
    });
  });
});
