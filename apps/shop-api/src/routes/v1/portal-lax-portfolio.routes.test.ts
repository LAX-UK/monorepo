import { verifyBearerToken } from "@auction/auth/token-verifier";
import { LaxMoneyResponseV1, LaxPortfolioResponseV1 } from "@auction/lax-ecosystem";
import { Value } from "@sinclair/typebox/value";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({ verifyBearerToken: vi.fn() }));

import { createShopApiApp } from "../../app.js";
import { createLaxPortfolioHandlers } from "../../application/lax-portfolio/lax-portfolio.handler.js";
import type { PortalPortfolioFacts } from "../../application/ports/portal-portfolio.reader.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import {
  NO_FACTS,
  edition,
  facts,
  order,
  original,
  pendingLine,
  refund,
  sale,
} from "../../test-support/portfolio-facts.js";

const BFF_TOKEN = "test-bff-token-minimum-32-characters-long";
const USER_HEADERS = { authorization: "Bearer user-portal-token" };

function signInWithScope(scope: string) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: "portal-subject-1",
    payload: { scope },
  } as never);
}

async function appWith(options: {
  facts?: PortalPortfolioFacts;
  ownership?: boolean;
  payouts?: boolean;
}) {
  const loadFacts = vi.fn().mockResolvedValue(options.facts ?? NO_FACTS);
  const base = createMinimalShopApiTestDeps();
  const laxPortfolio = createLaxPortfolioHandlers({
    reader: { loadFacts },
    flags: {
      portalOwnershipEnabled: options.ownership ?? true,
      payoutsEnabled: options.payouts ?? true,
    },
    context: {
      shopOrigin: "https://shop.lax.art",
      artOrigin: "https://lax.art",
      legalName: "LAX Art Ltd",
    },
    resolveMediaUrl: (key) => (key ? `https://cdn.lax.art/${key}` : null),
  });
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: {
        ...base.env,
        SHOP_PORTAL_OWNERSHIP_ENABLED: options.ownership ?? true,
        SHOP_PAYOUTS_ENABLED: options.payouts ?? true,
      },
      portal: { ...base.portal, laxPortfolio },
    }),
    logger: false,
  });
  await app.ready();
  return { app, loadFacts };
}

beforeEach(() => {
  vi.mocked(verifyBearerToken).mockReset();
  signInWithScope("shop.read");
});

describe.each([
  ["/v1/me/lax-portfolio", LaxPortfolioResponseV1],
  ["/v1/me/lax-money", LaxMoneyResponseV1],
] as const)("GET %s authentication", (url, schema) => {
  it("rejects a request without a bearer token", async () => {
    const { app, loadFacts } = await appWith({});
    const response = await app.inject({ method: "GET", url });
    expect(response.statusCode).toBe(401);
    expect(loadFacts).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects the BFF token, which carries no person", async () => {
    const { app } = await appWith({});
    const response = await app.inject({
      method: "GET",
      url,
      headers: { authorization: `Bearer ${BFF_TOKEN}` },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it.each(["shop.read", "lax.portfolio.read", "shop.read shop.write"])(
    "accepts the scope %s",
    async (scope) => {
      signInWithScope(scope);
      const { app } = await appWith({});
      const response = await app.inject({ method: "GET", url, headers: USER_HEADERS });
      expect(response.statusCode).toBe(200);
      expect(Value.Check(schema, response.json())).toBe(true);
      await app.close();
    },
  );

  it.each(["shop.write", "shop.admin", "bid.read", ""])(
    "rejects a token with the scope %j",
    async (scope) => {
      signInWithScope(scope);
      const { app, loadFacts } = await appWith({});
      const response = await app.inject({ method: "GET", url, headers: USER_HEADERS });
      expect(response.statusCode).toBe(403);
      expect(loadFacts).not.toHaveBeenCalled();
      await app.close();
    },
  );

  it("reads for the token's subject only and is never cached by a shared cache", async () => {
    const { app, loadFacts } = await appWith({});
    const response = await app.inject({ method: "GET", url, headers: USER_HEADERS });
    expect(loadFacts).toHaveBeenCalledWith("portal-subject-1", { includeSales: true });
    expect(response.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  it("is read-only", async () => {
    const { app } = await appWith({});
    const response = await app.inject({ method: "POST", url, headers: USER_HEADERS });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe("GET /v1/me/lax-portfolio", () => {
  it("returns an empty list for a person with nothing", async () => {
    const { app } = await appWith({});
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/lax-portfolio",
      headers: USER_HEADERS,
    });
    expect(response.json()).toEqual({ items: [] });
    await app.close();
  });

  it("returns editions, originals, unpaid orders and sales in the contract shape", async () => {
    const { app } = await appWith({
      facts: facts({
        editions: [edition()],
        originals: [original()],
        pendingOrderLines: [pendingLine()],
        sales: [sale()],
      }),
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/lax-portfolio",
      headers: USER_HEADERS,
    });
    const body = response.json();
    expect(Value.Check(LaxPortfolioResponseV1, body)).toBe(true);
    expect(body.items.map((i: { status: string }) => i.status)).toEqual([
      "owned",
      "owned",
      "awaiting_payment",
      "payout_paid",
    ]);
    expect(body.items.map((i: { product: string }) => i.product)).toEqual([
      "shop",
      "art",
      "shop",
      "shop",
    ]);
    await app.close();
  });

  it("returns an empty, partial list rather than an error when portal ownership is off", async () => {
    const { app, loadFacts } = await appWith({ ownership: false });
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/lax-portfolio",
      headers: USER_HEADERS,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], partial: true });
    expect(loadFacts).not.toHaveBeenCalled();
    await app.close();
  });

  it("flags the list as partial when payouts are off", async () => {
    const { app, loadFacts } = await appWith({
      facts: facts({ editions: [edition()] }),
      payouts: false,
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/lax-portfolio",
      headers: USER_HEADERS,
    });
    expect(response.json()).toMatchObject({ partial: true });
    expect(response.json().items).toHaveLength(1);
    expect(loadFacts).toHaveBeenCalledWith("portal-subject-1", { includeSales: false });
    await app.close();
  });
});

describe("GET /v1/me/lax-money", () => {
  it("returns an empty list for a person with no money", async () => {
    const { app } = await appWith({});
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/lax-money",
      headers: USER_HEADERS,
    });
    expect(response.json()).toEqual({ entries: [] });
    await app.close();
  });

  it("reports orders, refunds and payouts as separate directions in pounds", async () => {
    const { app } = await appWith({
      facts: facts({ orders: [order()], refunds: [refund()], sales: [sale()] }),
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/lax-money",
      headers: USER_HEADERS,
    });
    const body = response.json();
    expect(Value.Check(LaxMoneyResponseV1, body)).toBe(true);
    expect(body.entries.map((e: { direction: string }) => e.direction).sort()).toEqual([
      "fee",
      "owed_to_you",
      "paid",
      "refunded",
    ]);
    expect(new Set(body.entries.map((e: { currency: string }) => e.currency))).toEqual(
      new Set(["GBP"]),
    );
    await app.close();
  });

  it("returns an empty, partial list when portal ownership is off", async () => {
    const { app } = await appWith({ ownership: false });
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/lax-money",
      headers: USER_HEADERS,
    });
    expect(response.json()).toEqual({ entries: [], partial: true });
    await app.close();
  });
});
