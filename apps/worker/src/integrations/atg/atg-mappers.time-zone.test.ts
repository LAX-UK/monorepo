import { describe, expect, it } from "vitest";
import { testAtgConfig, testSale } from "./__fixtures__/atg-snapshots.js";
import { AtgMappingError, mapSaleToAuctionFields } from "./atg-mappers.js";

describe("mapSaleToAuctionFields time zone", () => {
  it("shows the auction in the sale's own zone", () => {
    const fields = mapSaleToAuctionFields(testSale({ timeZone: "Asia/Dubai" }), testAtgConfig);
    expect(fields.TimezoneId).toBe("Arabian Standard Time");
  });

  it("keeps London sales on GMT Standard Time", () => {
    const fields = mapSaleToAuctionFields(testSale(), testAtgConfig);
    expect(fields.TimezoneId).toBe("GMT Standard Time");
  });

  it("maps zones beyond the handful LAX sells in today", () => {
    const fields = mapSaleToAuctionFields(testSale({ timeZone: "Pacific/Chatham" }), testAtgConfig);
    expect(fields.TimezoneId).toBe("Chatham Islands Standard Time");
  });

  it("explains a zone ATG has no match for instead of guessing", () => {
    expect(() =>
      mapSaleToAuctionFields(testSale({ timeZone: "Nowhere/Land" }), testAtgConfig),
    ).toThrow(new AtgMappingError('ATG has no matching time zone for "Nowhere/Land".'));
  });
});
