import { afterEach, describe, expect, it, vi } from "vitest";
import { item, moneyEntry } from "../domain/portfolio-fixtures.test-util";
import type { ResourceTokenProvider, SessionHandle } from "../ports/portfolio-gateway";
import { createProductPortfolioGateway } from "./product-portfolio-gateway";

const handle = { sessionId: "sess", record: {} } as unknown as SessionHandle;
const apiUrls = { bid: "https://bid-api.internal", shop: "https://shop-api.internal" };

const tokens: ResourceTokenProvider = {
  tokenFor: async (_handle, resource) => `token-for-${resource}`,
};

function gateway(
  respond: (url: string) => Promise<Response>,
  overrides: Partial<Parameters<typeof createProductPortfolioGateway>[0]> = {},
) {
  const fetchImpl = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
    respond(String(url)),
  );
  return {
    fetchImpl,
    gateway: createProductPortfolioGateway({
      apiUrls,
      tokens,
      fetchImpl: fetchImpl as never,
      timeoutMs: 50,
      ...overrides,
    }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("createProductPortfolioGateway", () => {
  it("reads both products in parallel, each with its own audience's token", async () => {
    const { gateway: g, fetchImpl } = gateway(async (url) =>
      Response.json({ items: [item({ id: url.includes("bid-api") ? "b" : "s" })] }),
    );

    const results = await g.readPortfolio(handle);

    expect(results.bid).toMatchObject({ status: "ok", partial: false });
    expect(results.bid.status === "ok" && results.bid.rows[0]?.id).toBe("b");
    expect(results.shop.status === "ok" && results.shop.rows[0]?.id).toBe("s");
    const calls = fetchImpl.mock.calls.map(([url, init]) => [
      String(url),
      (init as RequestInit).headers,
    ]);
    expect(calls).toEqual([
      [
        "https://bid-api.internal/users/me/lax-portfolio",
        { Authorization: "Bearer token-for-lax-bid-api", Accept: "application/json" },
      ],
      [
        "https://shop-api.internal/v1/me/lax-portfolio",
        { Authorization: "Bearer token-for-lax-shop-api", Accept: "application/json" },
      ],
    ]);
  });

  it("reads money from the money routes", async () => {
    const { gateway: g, fetchImpl } = gateway(async () =>
      Response.json({ entries: [moneyEntry()] }),
    );

    const results = await g.readMoney(handle);

    expect(results.bid).toMatchObject({ status: "ok" });
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "https://bid-api.internal/users/me/lax-money",
      "https://shop-api.internal/v1/me/lax-money",
    ]);
  });

  it("reports one failing product unavailable and still returns the other", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { gateway: g } = gateway(async (url) =>
      url.includes("bid-api")
        ? new Response("boom", { status: 500 })
        : Response.json({ items: [item({ product: "shop", id: "s" })] }),
    );

    const results = await g.readPortfolio(handle);

    expect(results.bid).toEqual({ status: "unavailable" });
    expect(results.shop).toMatchObject({ status: "ok" });
  });

  it("gives up on a product that is too slow without waiting for it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { gateway: g } = gateway((url) =>
      url.includes("bid-api")
        ? new Promise<Response>(() => undefined)
        : Promise.resolve(Response.json({ items: [] })),
    );

    const started = Date.now();
    const results = await g.readPortfolio(handle);

    expect(results.bid).toEqual({ status: "unavailable" });
    expect(results.shop).toMatchObject({ status: "ok" });
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("counts a token exchange that hangs against the same deadline", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { gateway: g } = gateway(async () => Response.json({ items: [] }), {
      tokens: { tokenFor: () => new Promise<string>(() => undefined) },
    });

    const results = await g.readPortfolio(handle);

    expect(results.bid).toEqual({ status: "unavailable" });
    expect(results.shop).toEqual({ status: "unavailable" });
  });

  it("treats a refused token exchange as that product being unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { gateway: g, fetchImpl } = gateway(async () => Response.json({ items: [] }), {
      tokens: {
        tokenFor: async (_h, resource) => {
          if (resource === "lax-bid-api") throw new Error("invalid_target");
          return "shop-token";
        },
      },
    });

    const results = await g.readPortfolio(handle);

    expect(results.bid).toEqual({ status: "unavailable" });
    expect(results.shop).toMatchObject({ status: "ok" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a body that breaks the contract", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { gateway: g } = gateway(async () =>
      Response.json({ items: [{ ...item(), status: "lost" }] }),
    );

    const results = await g.readPortfolio(handle);

    expect(results.bid).toEqual({ status: "unavailable" });
    expect(results.shop).toEqual({ status: "unavailable" });
  });

  it("carries the partial flag so the page cannot present the rows as complete", async () => {
    const { gateway: g } = gateway(async (url) =>
      Response.json({ items: [], ...(url.includes("bid-api") ? { partial: true } : {}) }),
    );

    const results = await g.readPortfolio(handle);

    expect(results.bid).toMatchObject({ status: "ok", partial: true });
    expect(results.shop).toMatchObject({ status: "ok", partial: false });
  });

  it("reports a product with no configured API as unavailable without calling it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { gateway: g, fetchImpl } = gateway(async () => Response.json({ items: [] }), {
      apiUrls: { shop: apiUrls.shop },
    });

    const results = await g.readPortfolio(handle);

    expect(results.bid).toEqual({ status: "unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never logs the token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { gateway: g } = gateway(async () => new Response("no", { status: 403 }));

    await g.readPortfolio(handle);

    expect(JSON.stringify(warn.mock.calls)).not.toContain("token-for");
  });
});
