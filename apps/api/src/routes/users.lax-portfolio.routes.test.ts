import { LaxMoneyResponseV1, LaxPortfolioResponseV1 } from "@auction/lax-ecosystem";
import type { BidPortfolioFacts } from "@auction/persistence/interfaces";
import { Value } from "@sinclair/typebox/value";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRouteServices } from "../container/create-user-route-services.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import {
  NO_FACTS,
  facts,
  payment,
  payout,
  sellerLot,
  submission,
  wonLot,
} from "../testing/bid-portfolio-facts.js";
import { createTestUserRouteServicesInput } from "../testing/create-test-user-route-services.js";
import { createUserRoutes } from "./users.js";

function portfolioApp(opts: {
  facts?: BidPortfolioFacts;
  user?: { scopes: string[] } | null;
  suspended?: boolean;
}) {
  const loadForPerson = vi.fn().mockResolvedValue(opts.facts ?? NO_FACTS);
  const userRoutes = createUserRouteServices(
    createTestUserRouteServicesInput({
      bidPortfolioReader: { loadForPerson },
      mediaUrlResolver: {
        resolveManyUnique: vi.fn(
          async (keys: string[]) => new Map(keys.map((key) => [key, `https://cdn.lax.bid/${key}`])),
        ),
      } as never,
    }),
  );
  const container = {
    env: {},
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(opts.suspended ?? false) },
    userRoutes,
  } as unknown as Container;
  const user = opts.user === undefined ? { scopes: ["lax.portfolio.read"] } : opts.user;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue(user ? { id: "user-1", role: "client", staffRole: null, ...user } : null),
  };
  const app = new Hono();
  app.route("/users", createUserRoutes(container, authenticator));
  return { app, loadForPerson };
}

const get = (app: Hono, path: string) => app.request(`/users/me/${path}`);

describe.each([
  ["lax-portfolio", LaxPortfolioResponseV1],
  ["lax-money", LaxMoneyResponseV1],
] as const)("GET /users/me/%s authentication", (path, schema) => {
  it("rejects a request with no signed-in user", async () => {
    const { app, loadForPerson } = portfolioApp({ user: null });
    const res = await get(app, path);
    expect(res.status).toBe(401);
    expect(loadForPerson).not.toHaveBeenCalled();
  });

  it.each([["lax.portfolio.read"], ["bid.read"], ["bid.read", "bid.write"]])(
    "accepts the scopes %s",
    async (...scopes) => {
      const { app } = portfolioApp({ user: { scopes } });
      const res = await get(app, path);
      expect(res.status).toBe(200);
      expect(Value.Check(schema, await res.json())).toBe(true);
    },
  );

  it.each([[["bid.write"]], [["shop.read"]], [[]]])(
    "rejects a token whose scopes are %j",
    async (scopes) => {
      const { app, loadForPerson } = portfolioApp({ user: { scopes } });
      const res = await get(app, path);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "insufficient_scope" });
      expect(loadForPerson).not.toHaveBeenCalled();
    },
  );

  it("rejects a suspended account", async () => {
    const { app } = portfolioApp({ suspended: true });
    expect((await get(app, path)).status).toBe(403);
  });

  it("is never cached by a shared cache", async () => {
    const { app } = portfolioApp({});
    expect((await get(app, path)).headers.get("cache-control")).toBe("private, no-store");
  });

  it("reads for the signed-in person only", async () => {
    const { app, loadForPerson } = portfolioApp({});
    await get(app, path);
    expect(loadForPerson).toHaveBeenCalledWith("user-1");
  });

  it("is read-only", async () => {
    const { app } = portfolioApp({});
    const res = await app.request(`/users/me/${path}`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("a narrow portfolio token", () => {
  it("does not open the other user routes", async () => {
    const { app } = portfolioApp({});
    expect((await app.request("/users/me/bids")).status).toBe(403);
  });
});

describe("GET /users/me/lax-portfolio", () => {
  it("returns an empty, valid response for a person with nothing", async () => {
    const { app } = portfolioApp({});
    const body = await (await get(app, "lax-portfolio")).json();
    expect(body).toEqual({ items: [] });
  });

  it("lists an unpaid win with a pay action", async () => {
    const { app } = portfolioApp({ facts: facts({ wonLots: [wonLot()] }) });
    const body = (await (await get(app, "lax-portfolio")).json()) as LaxPortfolioResponseV1;
    expect(Value.Check(LaxPortfolioResponseV1, body)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      status: "awaiting_payment",
      image: "https://cdn.lax.bid/lots/blue-study.jpg",
      actions: [{ kind: "pay" }, { kind: "view" }],
    });
    expect(body.items[0]?.actions[0]?.href).toMatch(/\/purchases\/checkout\/11111111-/);
  });

  it("returns wins, consignments and sales together, each in the contract shape", async () => {
    const { app } = portfolioApp({
      facts: facts({
        wonLots: [wonLot()],
        payments: [payment()],
        submissions: [submission()],
        sellerLots: [
          sellerLot({ stage: "sold", buyerPaid: true, payoutStatus: "paid" }),
          sellerLot({ lotId: "66666666-6666-4666-8666-666666666666" }),
        ],
      }),
    });
    const body = (await (await get(app, "lax-portfolio")).json()) as LaxPortfolioResponseV1;
    expect(Value.Check(LaxPortfolioResponseV1, body)).toBe(true);
    expect(body.items.map((i) => i.status)).toEqual([
      "owned",
      "consigned",
      "payout_paid",
      "in_sale",
    ]);
    expect(new Set(body.items.map((i) => i.business.key))).toEqual(new Set(["lax_bid"]));
  });
});

describe("GET /users/me/lax-money", () => {
  it("returns an empty, valid response for a person with no money", async () => {
    const { app } = portfolioApp({});
    expect(await (await get(app, "lax-money")).json()).toEqual({ entries: [] });
  });

  it("reports unpaid, paid, refunded and payout money without netting them", async () => {
    const { app } = portfolioApp({
      facts: facts({
        payments: [
          payment({ id: "a", status: "pending" }),
          payment({ id: "b", status: "captured" }),
          payment({ id: "c", status: "refunded" }),
        ],
        payouts: [payout()],
      }),
    });
    const body = (await (await get(app, "lax-money")).json()) as LaxMoneyResponseV1;
    expect(Value.Check(LaxMoneyResponseV1, body)).toBe(true);
    expect(body.entries.map((e) => e.direction).sort()).toEqual([
      "fee",
      "fee",
      "owed_by_you",
      "owed_to_you",
      "paid",
      "paid",
      "refunded",
    ]);
  });

  it("keeps mixed currencies on separate entries", async () => {
    const { app } = portfolioApp({
      facts: facts({
        payments: [payment()],
        payouts: [payout({ currency: "EUR", platformFee: "0.00", stripeFee: "0.00" })],
      }),
    });
    const body = (await (await get(app, "lax-money")).json()) as LaxMoneyResponseV1;
    expect(body.entries.map((e) => e.currency).sort()).toEqual(["EUR", "GBP"]);
  });
});
