import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerShopAuthPlugin } from "./shop-auth.js";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => null),
}));

const BFF_TOKEN = "test-bff-token-minimum-32-characters-long";

describe("shop-auth", () => {
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.close();
    }
  });

  function createApp() {
    const app = Fastify({ logger: false });
    registerShopAuthPlugin(app, {
      jwksUrl: "http://localhost:3001/.well-known/jwks.json",
      issuer: "http://localhost:3001",
      bffToken: BFF_TOKEN,
    });
    app.get("/v1/basket", async (request) => ({ auth: request.shopAuth?.kind ?? "none" }));
    app.get("/v1/orders", async (request) => ({ auth: request.shopAuth?.kind ?? "none" }));
    apps.push(app);
    return app;
  }

  it("allows BFF bearer tokens on protected commerce paths", async () => {
    const app = createApp();
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/basket",
      headers: { authorization: `Bearer ${BFF_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ auth: "bff" });
  });

  it("requires authorization on basket and order routes", async () => {
    const app = createApp();
    await app.ready();
    const basket = await app.inject({ method: "GET", url: "/v1/basket" });
    expect(basket.statusCode).toBe(401);
    const orders = await app.inject({ method: "GET", url: "/v1/orders" });
    expect(orders.statusCode).toBe(401);
  });

  it("does not require auth on health routes", async () => {
    const app = Fastify({ logger: false });
    registerShopAuthPlugin(app, {
      jwksUrl: "http://localhost:3001/.well-known/jwks.json",
      issuer: "http://localhost:3001",
      bffToken: BFF_TOKEN,
    });
    app.get("/health", async () => ({ ok: true }));
    apps.push(app);
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
  });
});
