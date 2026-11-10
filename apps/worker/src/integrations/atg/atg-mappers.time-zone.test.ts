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

  it("falls back to the configured zone when the sale names none", () => {
    const fields = mapSaleToAuctionFields(testSale({ timeZone: " " }), {
      ...testAtgConfig,
      timezone: "Europe/Paris",
    });
    expect(fields.TimezoneId).toBe("Romance Standard Time");
  });

  it("explains a zone ATG has no match for instead of guessing", () => {
    expect(() =>
      mapSaleToAuctionFields(testSale({ timeZone: "Pacific/Chatham" }), testAtgConfig),
    ).toThrow(new AtgMappingError('ATG has no matching time zone for "Pacific/Chatham".'));
  });
});
