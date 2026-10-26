import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { AtgGatewayError } from "./atg-gateway.js";
import { GapHttpAdapter, isRetryableGapStatus } from "./gap-http-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

type Call = { url: string; init: RequestInit };

function adapterWith(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  const adapter = new GapHttpAdapter({
    baseUrl: "https://gap.test/",
    username: "api@lax.bid",
    password: "s3cret",
    fetchImpl,
  });
  return { adapter, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

describe("GapHttpAdapter", () => {
  it("sends Basic Auth and JSON to CreateAuction and returns the AuctionId", async () => {
    const { adapter, calls } = adapterWith([json({ AuctionId: "a-1" })]);

    const out = await adapter.createAuction({
      Title: "Spring Sale",
      AuctionListings: [
        { PlatformCode: "LAX", AuctionTypeAndListing: "Timed", CategoryName: "Art", Private: true },
      ],
      TimezoneId: "GMT Standard Time",
      Currency: "GBP",
      CountryCode: "UK",
      IncrementSetId: "inc-1",
    });

    expect(out).toEqual({ auctionId: "a-1" });
    expect(calls[0]?.url).toBe("https://gap.test/Auction/CreateAuction");
    expect(calls[0]?.init.method).toBe("POST");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(
      `Basic ${Buffer.from("api@lax.bid:s3cret").toString("base64")}`,
    );
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ Currency: "GBP" });
  });

  it("uses PUT for UpdateAuction, PATCH for UpdateLot and accepts empty bodies", async () => {
    const { adapter, calls } = adapterWith([json(""), json("{}")]);

    await adapter.updateAuction({
      AuctionId: "a-1",
      Title: "t",
      AuctionListings: [],
      TimezoneId: "UTC",
      Currency: "GBP",
      CountryCode: "UK",
      IncrementSetId: "inc-1",
    });
    await adapter.updateLot({
      LotId: "l-1",
      AuctionId: "a-1",
      LotNumber: "1",
      Title: "t",
      LongDescription: "d",
      CategoryName: "Art",
      Quantity: 1,
    });

    expect(calls.map((c) => c.init.method)).toEqual(["PUT", "PATCH"]);
    expect(calls[1]?.url).toBe("https://gap.test/Lot/UpdateLot");
  });

  it("deletes lots via the query-string contract and treats 404 as already deleted", async () => {
    const { adapter, calls } = adapterWith([json("", 404)]);

    await expect(adapter.deleteLot("l 1")).resolves.toBeUndefined();
    expect(calls[0]?.url).toBe("https://gap.test/Lot/DeleteLot?request.lotId=l%201");
    expect(calls[0]?.init.method).toBe("DELETE");
  });

  it("maps v2/GetLots rows, parsing /Date()/ and skipping rows without LotId", async () => {
    const { adapter, calls } = adapterWith([json(fixture("get-lots.json"))]);

    const lots = await adapter.getLots("auction-1");

    expect(calls[0]?.url).toBe("https://gap.test/Lot/v2/GetLots/auction-1");
    expect(lots).toHaveLength(2);
    expect(lots[0]).toEqual({
      atgLotId: "6f0d2b7e-1c1a-4c55-9d4f-0a6b8f3f1a01",
      lotNumber: "1",
      status: 2,
      sold: true,
      hammerPrice: 1500,
      currentMaxBid: 1500,
      numberOfBids: 7,
      winningBidderId: "c3c1d9a2-5b8e-4a77-9f0e-6f2d1e4b7a22",
      endTimeUtc: new Date(1792072800000),
    });
    expect(lots[1]?.endTimeUtc).toBeNull();
  });

  it("drops bidder names from GetSaleResults", async () => {
    const { adapter } = adapterWith([json(fixture("get-sale-results.json"))]);

    const [row] = await adapter.getSaleResults("auction-1");

    expect(row).toEqual({
      atgLotId: "6f0d2b7e-1c1a-4c55-9d4f-0a6b8f3f1a01",
      lotNumber: "1",
      lotStatus: "Sold",
      numberOfBids: 7,
      paddleNumber: "1042",
      hammerPrice: 1500,
      totalHammerPrice: 1500,
      endTimeUtc: new Date(1792072800000).toISOString(),
    });
    expect(JSON.stringify(row)).not.toContain("Jane");
  });

  it("maps approval and publication from GetAuctionById, and a 404 to null", async () => {
    const { adapter, calls } = adapterWith([
      json({
        AuctionId: "a-1",
        ClientsAuctionId: "sale-1",
        IsApproved: true,
        IsPublished: false,
        AuctionStatusCode: 2,
      }),
      json({ Message: "not found" }, 404),
    ]);

    expect(await adapter.getAuction("a-1")).toEqual({
      atgAuctionId: "a-1",
      clientsAuctionId: "sale-1",
      isApproved: true,
      isPublished: false,
      statusCode: 2,
    });
    expect(calls[0]?.url).toBe("https://gap.test/Auction/GetAuctionById/a-1");
    expect(await adapter.getAuction("a-2")).toBeNull();
  });

  it("lists a client's auctions from a date, whether ATG returns a list or one object", async () => {
    const { adapter, calls } = adapterWith([
      json([{ AuctionId: "a-1", ClientsAuctionId: "sale-1" }, { Title: "no id" }]),
      json({ AuctionId: "a-2", IsApproved: true }),
      json(""),
    ]);
    const from = new Date("2026-10-12T10:00:00Z");

    expect(await adapter.findAuctionsByClientId("client-1", from)).toEqual([
      {
        atgAuctionId: "a-1",
        clientsAuctionId: "sale-1",
        isApproved: false,
        isPublished: false,
        statusCode: null,
      },
    ]);
    expect(calls[0]?.url).toBe(
      "https://gap.test/Auction/GetAuctionsByClientId/client-1?fromDate=2026-10-12T10%3A00%3A00.000Z",
    );
    expect(await adapter.findAuctionsByClientId("client-1", from)).toMatchObject([
      { atgAuctionId: "a-2", isApproved: true },
    ]);
    expect(await adapter.findAuctionsByClientId("client-1", from)).toEqual([]);
  });

  it("reads the client's increment sets and the platform's categories", async () => {
    const { adapter, calls } = adapterWith([
      json([{ IncrementSetId: "inc-1", IncrementSetName: "Default", IncrementSets: [] }, {}]),
      json([{ CategoryName: "Fine Art", CategoryCode: "FA" }, { CategoryCode: "none" }]),
    ]);

    expect(await adapter.getIncrementSets("client-1")).toEqual([
      { incrementSetId: "inc-1", name: "Default" },
    ]);
    expect(await adapter.getSupportedCategories("LAX")).toEqual(["Fine Art"]);
    expect(calls.map((c) => c.url)).toEqual([
      "https://gap.test/Clients/GetIncrementDetails/client-1",
      "https://gap.test/Auction/GetSupportedCategories/LAX",
    ]);
  });

  it("surfaces ServiceStack validation messages as non-retryable errors", async () => {
    const { adapter } = adapterWith([json(fixture("error-validation.json"), 400)]);

    const err = await adapter.publishAuction("a-1").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AtgGatewayError);
    expect(err).toMatchObject({
      retryable: false,
      status: 400,
      operation: "publishAuction",
      message: "ATG publishAuction failed with HTTP 400: 'Currency' must not be empty.",
    });
  });

  it("classifies network failures and 5xx as retryable", async () => {
    const { adapter } = adapterWith([new TypeError("fetch failed"), json("boom", 503)]);

    await expect(adapter.closeAuction("a-1")).rejects.toMatchObject({
      retryable: true,
      status: null,
    });
    await expect(adapter.closeAuction("a-1")).rejects.toMatchObject({
      retryable: true,
      status: 503,
      message: "ATG closeAuction failed with HTTP 503: boom",
    });
  });

  it("rejects success responses missing the created id", async () => {
    const { adapter } = adapterWith([json({})]);

    await expect(
      adapter.createLot({
        AuctionId: "a-1",
        LotNumber: "1",
        Title: "t",
        LongDescription: "d",
        CategoryName: "Art",
        Quantity: 1,
      }),
    ).rejects.toMatchObject({ retryable: false, message: "ATG createLot response missing LotId" });
  });
});

describe("isRetryableGapStatus", () => {
  it.each([
    [400, false],
    [401, false],
    [404, false],
    [408, true],
    [429, true],
    [500, true],
    [501, false],
    [503, true],
  ])("HTTP %i -> %s", (status, expected) => {
    expect(isRetryableGapStatus(status)).toBe(expected);
  });
});
