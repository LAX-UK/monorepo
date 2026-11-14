import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/server-api-base", () => ({ getServerApiBase: () => "http://api.test" }));
const cookies = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies, headers: cookies }));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const { getPublicLotBiddingView, getPublicSaleShell, getPublicLotById } = await import(
  "./public-catalogue.server"
);

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  cookies.mockReset();
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
    expect(cookies).not.toHaveBeenCalled();
  });

  it("drop the server clock reading, which a cached page would carry stale", async () => {
    fetchMock.mockResolvedValue(
      json({ data: { serverNow: "2026-11-14T10:00:00.000Z", nextBidAmount: "120.00" } }),
    );
    const view = await getPublicLotBiddingView("lot-1");
    expect(view.serverNow).toBeNull();
  });

  it("keep nothing personal from a sale answer", async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    expect(await getPublicSaleShell("hidden")).toBeNull();
  });
});
