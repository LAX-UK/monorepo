import { describe, expect, it } from "vitest";
import { testAtgConfig, testLot, testSale } from "./__fixtures__/atg-snapshots.js";
import {
  AtgMappingError,
  gapImageName,
  mapLotToLotFields,
  mapSaleToAuctionFields,
  payloadHash,
  resolveLotImageUrls,
} from "./atg-mappers.js";

describe("mapSaleToAuctionFields", () => {
  it("always sends ATG's server-required fields", () => {
    const fields = mapSaleToAuctionFields(testSale(), testAtgConfig);

    expect(fields).toMatchObject({
      Title: "Autumn Contemporary",
      ClientId: "client-1",
      AuctionListings: [
        {
          PlatformCode: "LAX",
          AuctionTypeAndListing: "Timed",
          CategoryName: "Fine Art",
          Private: true,
        },
      ],
      TimezoneId: "GMT Standard Time",
      Currency: "GBP",
      CountryCode: "UK",
      IncrementSetId: "inc-1",
      ClientsAuctionId: "sale-1",
      BuyersPremium: 25,
      TimedStart: "2026-10-20T10:00:00.000Z",
      TimedFirstLotEnds: "2026-11-01T18:00:00.000Z",
      Address1: "1 Gallery Road",
      TownCity: "London",
      Postcode: "W1 1AA",
      ImportantInformation: "Viewing by appointment.",
      Terms: "Standard terms apply.",
    });
    expect(fields).not.toHaveProperty("Address2");
  });

  it("omits timed-only fields for live auctions", () => {
    const fields = mapSaleToAuctionFields(testSale(), { ...testAtgConfig, auctionType: "Live" });

    expect(fields.TimedStart).toBeUndefined();
    expect(fields.SaleDates).toEqual([
      { Starts: "2026-10-20T10:00:00.000Z", Ends: "2026-11-01T18:00:00.000Z" },
    ]);
  });

  it("converts fractional premium rates to percentages without float noise", () => {
    const fields = mapSaleToAuctionFields(testSale({ buyerPremiumRate: "0.2875" }), testAtgConfig);
    expect(fields.BuyersPremium).toBe(28.75);
  });
});

describe("mapLotToLotFields", () => {
  it("maps catalogue data with artist, medium and dimensions in the description", () => {
    const fields = mapLotToLotFields(testLot(), testSale(), 4, testAtgConfig);

    expect(fields).toEqual({
      LotNumber: "1",
      Title: "Untitled (Blue)",
      LongDescription:
        "Jane Painter\nUntitled (Blue)\nOil on canvas\n60 x 50 cm\n\nSigned lower right.",
      CategoryName: "Fine Art",
      Quantity: 1,
      SequenceNumber: 4,
      LowEstimate: 800,
      HighEstimate: 1200,
      OpeningPrice: 500,
      Reserve: 800,
      EndTimeUtc: "2026-11-01T18:00:00.000Z",
    });
  });

  it("prefixes the artist in the title when configured and enforces the 100-char limit", () => {
    const fields = mapLotToLotFields(testLot({ title: "x".repeat(120) }), testSale(), 1, {
      ...testAtgConfig,
      artistPlacement: "title_prefix",
    });

    expect(fields.Title).toHaveLength(100);
    expect(fields.Title.startsWith("Jane Painter - x")).toBe(true);
    expect(fields.Title.endsWith("…")).toBe(true);
    expect(fields.LongDescription.startsWith("x")).toBe(true);
  });

  it("truncates LongDescription at 8000 chars", () => {
    const fields = mapLotToLotFields(
      testLot({ description: "y".repeat(9000) }),
      testSale(),
      1,
      testAtgConfig,
    );
    expect(fields.LongDescription).toHaveLength(8000);
  });

  it("sends a lot-level premium only when it differs from the sale", () => {
    expect(
      mapLotToLotFields(testLot(), testSale(), 1, testAtgConfig).BuyersPremiumPercent,
    ).toBeUndefined();
    expect(
      mapLotToLotFields(testLot({ buyerPremiumRate: "0.2000" }), testSale(), 1, testAtgConfig)
        .BuyersPremiumPercent,
    ).toBe(20);
  });

  it.each([
    [{ estimate: { low: "800", high: "1200", currency: "EUR" } }],
    [{ estimate: { low: "1200", high: "800", currency: "GBP" } }],
    [{ estimate: { low: "", high: "800", currency: "GBP" } }],
    [{}],
  ])("skips estimates that are foreign-currency, inverted or incomplete (%j)", (details) => {
    const fields = mapLotToLotFields(
      testLot({ marketingDetails: details }),
      testSale(),
      1,
      testAtgConfig,
    );
    expect(fields.LowEstimate).toBeUndefined();
    expect(fields.HighEstimate).toBeUndefined();
  });

  it("refuses lots without a lot number", () => {
    expect(() =>
      mapLotToLotFields(testLot({ lotNumber: null }), testSale(), 1, testAtgConfig),
    ).toThrow(AtgMappingError);
  });

  it("drops zero or empty prices", () => {
    const fields = mapLotToLotFields(
      testLot({ reservePrice: null, buyNowPrice: "0.00" }),
      testSale(),
      1,
      testAtgConfig,
    );
    expect(fields.Reserve).toBeUndefined();
    expect(fields.BuyItNowPrice).toBeUndefined();
  });
});

describe("lot images", () => {
  it("resolves storage keys against the media origin, keeps absolute URLs, and caps the count", () => {
    const urls = resolveLotImageUrls(
      testLot({
        images: ["lots/a b.jpg", "https://cdn.other/x.jpg", "/lots/c.jpg", "", "lots/d.jpg"],
      }),
      testAtgConfig,
    );
    expect(urls).toEqual([
      "https://media.example/lots/a%20b.jpg",
      "https://cdn.other/x.jpg",
      "https://media.example/lots/c.jpg",
    ]);
  });

  it("names images in GAP order", () => {
    expect([0, 1, 2].map(gapImageName)).toEqual(["1", "1-1", "1-2"]);
  });
});

describe("payloadHash", () => {
  it("ignores key order and undefined values", () => {
    expect(payloadHash({ a: 1, b: [1, { c: 2, d: undefined }] })).toBe(
      payloadHash({ b: [1, { c: 2 }], a: 1 }),
    );
    expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }));
  });
});
