import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const net = vi.hoisted(() => ({
  catalogueFetch: vi.fn(),
  lotGet: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("@/lib/data/http/catalogue-fetch", () => ({
  catalogueFetch: net.catalogueFetch,
  CATALOGUE_FETCH_POLICIES: { artists: {}, sales: {}, lots: {} },
}));
vi.mock("@/lib/data/http/hc-server", () => ({
  getServerApiBase: () => "http://api.test",
  getServerHc: async () => ({ lots: { ":id": { $get: net.lotGet } } }),
}));
vi.mock("@/lib/data/http/server-api-base", () => ({ getServerApiBase: () => "http://api.test" }));
vi.mock("next/headers", () => ({ cookies: net.cookies }));
// `cache()` memoises per request; each test is its own request.
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

import { registryArtistPageExists } from "@/lib/data/http/artist.reader";
import { getServerSaleShell } from "@/lib/data/http/sales.reader";
import { withdrawnLotPageExists } from "@/lib/lot-page/load-withdrawn-lot.server";

const res = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  net.catalogueFetch.mockReset();
  net.lotGet.mockReset();
  net.cookies.mockReset().mockResolvedValue({ getAll: () => [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("registryArtistPageExists", () => {
  it("is missing for a 404", async () => {
    net.catalogueFetch.mockResolvedValue(res(404));
    await expect(registryArtistPageExists("a")).resolves.toBe("missing");
  });
  it("is missing while the artist pages are off, without a request", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ARTISTS", "false");
    await expect(registryArtistPageExists("a")).resolves.toBe("missing");
    expect(net.catalogueFetch).not.toHaveBeenCalled();
  });
  it("throws on a 5xx", async () => {
    net.catalogueFetch.mockResolvedValue(res(503));
    await expect(registryArtistPageExists("a")).rejects.toThrow("503");
  });
  it("throws on a network error", async () => {
    net.catalogueFetch.mockRejectedValue(new Error("ECONNRESET"));
    await expect(registryArtistPageExists("a")).rejects.toThrow("ECONNRESET");
  });
  it("throws on a malformed body", async () => {
    net.catalogueFetch.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 200 }));
    await expect(registryArtistPageExists("a")).rejects.toThrow();
  });
});

describe("getServerSaleShell", () => {
  it("is null for a 404 (also how a hidden or test sale looks to the public)", async () => {
    net.catalogueFetch.mockResolvedValue(res(404));
    await expect(getServerSaleShell("s")).resolves.toBeNull();
  });
  it("throws on a 5xx", async () => {
    net.catalogueFetch.mockResolvedValue(res(502));
    await expect(getServerSaleShell("s")).rejects.toThrow("502");
  });
  it("throws on a network error", async () => {
    net.catalogueFetch.mockRejectedValue(new Error("ETIMEDOUT"));
    await expect(getServerSaleShell("s")).rejects.toThrow("ETIMEDOUT");
  });
  it("throws on a malformed body", async () => {
    net.catalogueFetch.mockResolvedValue(res(200, { data: "not an object" }));
    await expect(getServerSaleShell("s")).rejects.toThrow();
  });
});

describe("withdrawnLotPageExists", () => {
  // The read is session-free and tagged (CO-7): a plain fetch, no cookies.
  beforeEach(() => {
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => net.lotGet(url, init));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the lot without the session, under the lot's tag", async () => {
    net.lotGet.mockResolvedValue(res(404));
    await withdrawnLotPageExists("l");
    const [url, init] = net.lotGet.mock.calls[0] as [string, RequestInit & { next?: unknown }];
    expect(url).toBe("http://api.test/lots/l");
    expect(init.headers).toBeUndefined();
    expect(init.next).toMatchObject({ tags: ["public-lot:l"] });
    expect(net.cookies).not.toHaveBeenCalled();
  });
  it("is missing for a 404", async () => {
    net.lotGet.mockResolvedValue(res(404));
    await expect(withdrawnLotPageExists("l")).resolves.toBe("missing");
  });
  it("is missing for a live lot, which the public reader handles", async () => {
    net.lotGet.mockResolvedValue(res(200, { data: { id: "l", status: "live" } }));
    await expect(withdrawnLotPageExists("l")).resolves.toBe("missing");
  });
  it("exists for a withdrawn lot, which keeps its page", async () => {
    net.lotGet.mockResolvedValue(
      res(200, {
        data: {
          id: "l",
          saleId: "s",
          lotNumber: 4,
          title: "T",
          description: "D",
          medium: "M",
          dimensions: "1 x 1",
          images: ["a.jpg"],
          artistId: "a1",
          auctionType: "english",
          status: "withdrawn",
        },
      }),
    );
    await expect(withdrawnLotPageExists("l")).resolves.toBe("exists");
  });
  it("throws on a 5xx", async () => {
    net.lotGet.mockResolvedValue(res(500));
    await expect(withdrawnLotPageExists("l")).rejects.toThrow("500");
  });
  it("throws on a network error", async () => {
    net.lotGet.mockRejectedValue(new Error("ECONNRESET"));
    await expect(withdrawnLotPageExists("l")).rejects.toThrow("ECONNRESET");
  });
});
