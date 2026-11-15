import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/server-api-base", () => ({ getServerApiBase: () => "http://api.test" }));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const publicCatalogue = await import("./public-catalogue.server");
const { getPublicLotPremiumTerms, getPublicSaleShell, getPublicLotById } = publicCatalogue;

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
