import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/server-api-base", () => ({ getServerApiBase: () => "http://api.test" }));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const publicCatalogue = await import("./public-catalogue.server");
const {
  getPublicLotPremiumTerms,
  getPublicLotStorageTerms,
  getPublicPlaceStorageTerms,
  getPublicSaleShell,
  getPublicLotById,
} = publicCatalogue;

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function lastInit(): RequestInit & { next?: { tags?: string[]; revalidate?: number } } {
  return fetchMock.mock.calls.at(-1)?.[1] ?? {};
}

describe("public catalogue reads (CO-7)", () => {
  it("never send the session, and carry the item's tag", async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    await getPublicLotById("lot-1");
    expect(lastInit().headers).toBeUndefined();
    expect(lastInit().next?.tags).toEqual(["public-lot:lot-1"]);
    await getPublicSaleShell("sale-1");
    expect(lastInit().next?.tags).toContain("public-sale:sale-1");
  });

  it("read only the premium terms off the lot, none of its bid figures", async () => {
    fetchMock.mockResolvedValue(
      json({
        data: {
          serverNow: "2026-11-14T10:00:00.000Z",
          nextBidAmount: "120.00",
          hammerPrice: "100.00",
          buyersPremium: { kind: "flat", rate: "0.25" },
        },
      }),
    );
    await expect(getPublicLotPremiumTerms("lot-1")).resolves.toEqual({
      kind: "flat",
      rate: "0.25",
    });
    expect(lastInit().next?.tags).toEqual(["public-lot:lot-1"]);
  });

  it("read the storage terms sentence off the same lot read", async () => {
    fetchMock.mockResolvedValue(
      json({ data: { storageTerms: "Storage is free for 14 days after your payment clears." } }),
    );
    await expect(getPublicLotStorageTerms("lot-2")).resolves.toBe(
      "Storage is free for 14 days after your payment clears.",
    );
    expect(lastInit().next?.tags).toEqual(["public-lot:lot-2"]);
  });

  it("read no storage terms from a lot whose place set none, or when the read fails", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { storageTerms: null } }));
    await expect(getPublicLotStorageTerms("lot-3")).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(json({}, 500));
    await expect(getPublicLotStorageTerms("lot-4")).resolves.toBeNull();
  });

  it("list the terms of each place for the shipping page, skipping malformed rows", async () => {
    fetchMock.mockResolvedValue(
      json({ data: [{ placeName: "LAX Gallery", text: "Storage is free." }, { text: 4 }, null] }),
    );
    await expect(getPublicPlaceStorageTerms()).resolves.toEqual([
      { placeName: "LAX Gallery", text: "Storage is free." },
    ]);
  });

  it("offer no bid read for the page to render from", () => {
    // The page carries no live bid state: bids, history and the bidding view are read live in the
    // browser, never through these cached reads.
    for (const name of ["getPublicLotBids", "getPublicLotBiddingView", "getPublicBidHistory"]) {
      expect(name in publicCatalogue).toBe(false);
    }
    for (const fn of Object.values(publicCatalogue)) {
      if (typeof fn !== "function") continue;
      expect(String(fn)).not.toMatch(/\/bids|\/bid-history/);
    }
  });

  it("keep nothing personal from a sale answer", async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    expect(await getPublicSaleShell("hidden")).toBeNull();
  });
});
