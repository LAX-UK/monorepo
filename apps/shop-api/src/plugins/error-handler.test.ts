import { ShopDomainError } from "@auction/shop-domain";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerErrorHandler } from "./error-handler.js";

function createErrorApp(error: unknown) {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  app.get("/fails", async () => {
    throw error;
  });
  return app;
}

describe("Shop API error handler", () => {
  it("maps domain conflicts to the stable conflict contract", async () => {
    const app = createErrorApp(new ShopDomainError("Artwork slug is immutable"));
    const response = await app.inject({ method: "GET", url: "/fails" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "shop.conflict" });
    await app.close();
  });

  it("does not treat raw PostgreSQL unique violations as HTTP conflicts", async () => {
    const app = createErrorApp(
      Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint: "shop_artwork_slug_uid",
      }),
    );
    const response = await app.inject({ method: "GET", url: "/fails" });

    expect(response.statusCode).toBe(500);
    await app.close();
  });

  it("maps oversized request bodies to 413 instead of an internal error", async () => {
    const app = Fastify({ logger: false, bodyLimit: 16 });
    registerErrorHandler(app);
    app.post("/echo", async () => ({ ok: true }));
    const response = await app.inject({
      method: "POST",
      url: "/echo",
      payload: { text: "x".repeat(64) },
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ code: "shop.validation" });
    await app.close();
  });

  it("answers the request limit with 429 and Retry-After, not an internal error", async () => {
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    await app.register(rateLimit, { max: 1, timeWindow: "1 minute" });
    app.get("/limited", async () => ({ ok: true }));

    expect((await app.inject({ method: "GET", url: "/limited" })).statusCode).toBe(200);
    const limited = await app.inject({ method: "GET", url: "/limited" });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(limited.json()).toMatchObject({ code: "shop.rate_limited" });
    await app.close();
  });
});
