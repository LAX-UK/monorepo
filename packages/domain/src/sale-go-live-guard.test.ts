import { describe, expect, it } from "vitest";
import { goLivePayoutsRefusalMessage, sellersWithoutPayouts } from "./sale-go-live-guard.js";

describe("sellersWithoutPayouts", () => {
  const lots = [
    { id: "l1", title: "Blue", sellerLegalEntityId: "s1" },
    { id: "l2", title: "Red", sellerLegalEntityId: "s2" },
    { id: "l3", title: "Green", sellerLegalEntityId: "s1" },
    { id: "l4", title: "House stock", sellerLegalEntityId: null },
  ];

  it("lists each seller without payouts once, with their lots", () => {
    expect(sellersWithoutPayouts(lots, (id) => id === "s2")).toEqual([
      {
        sellerLegalEntityId: "s1",
        lots: [
          { id: "l1", title: "Blue" },
          { id: "l3", title: "Green" },
        ],
      },
    ]);
  });

  it("lets the sale go live when every seller can be paid", () => {
    expect(sellersWithoutPayouts(lots, () => true)).toEqual([]);
  });

  it("never blocks on lots without a seller", () => {
    expect(sellersWithoutPayouts([lots[3] as (typeof lots)[number]], () => false)).toEqual([]);
  });
});

describe("goLivePayoutsRefusalMessage", () => {
  it("names one seller", () => {
    expect(goLivePayoutsRefusalMessage(["Jane Smith"])).toMatch(/^Jane Smith has not set up/);
  });

  it("names several sellers", () => {
    expect(goLivePayoutsRefusalMessage(["Jane Smith", "Northbank Gallery"])).toContain(
      "2 sellers have not set up payouts yet, so the sale can't go live: Jane Smith, Northbank Gallery.",
    );
  });
});
