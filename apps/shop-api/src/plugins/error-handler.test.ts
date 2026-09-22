import { ShopDomainError } from "@auction/shop-domain";
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
});
