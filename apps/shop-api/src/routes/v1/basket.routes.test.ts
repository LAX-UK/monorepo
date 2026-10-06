import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import type {
  BasketRecord,
  UpsertBasketLineInput,
} from "../../application/ports/commerce.ports.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const BFF_TOKEN = "test-bff-token-minimum-32-characters-long";
const BASKET_TOKEN = "guest-basket-token-value-0123456789";

function sampleBasket(overrides: Partial<BasketRecord> = {}): BasketRecord {
  return {
    basketId: "basket-1",
    owner: { kind: "anonymous", tokenHash: "abc" },
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    lines: [
      {
        lineId: "line-1",
        artworkId: "art-1",
        artworkSlug: "warm-basket",
        artworkTitle: "Warm Basket",
        productVariantId: null,
        productSlug: null,
        productTitle: null,
        variantSku: null,
        unitPricePence: 12000,
        livePricePence: 12000,
        quantity: 2,
        sellableCount: 5,
        imageUrl: null,
      },
    ],
    ...overrides,
  };
}

describe("basket routes", () => {
  it("parses JSON bodies on basket line upsert (not raw Buffer)", async () => {
    const upsertBasketLine = vi.fn(async (input: UpsertBasketLineInput) => {
      expect("artworkSlug" in input ? input.artworkSlug : null).toBe("warm-basket");
      expect(input.quantity).toBe(2);
      return sampleBasket();
    });
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        upsertBasketLine,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers: {
        authorization: `Bearer ${BFF_TOKEN}`,
        "x-shop-basket-token": BASKET_TOKEN,
        "content-type": "application/json",
      },
      payload: { artworkSlug: "warm-basket", quantity: 2 },
    });

    expect(response.statusCode).toBe(200);
    expect(upsertBasketLine).toHaveBeenCalledOnce();
    const body = response.json() as { lines: Array<{ artworkSlug: string }> };
    expect(body.lines[0]?.artworkSlug).toBe("warm-basket");
    await app.close();
  });

  it("accepts merchandise variant basket line upsert when merchandise is enabled", async () => {
    const variantId = "550e8400-e29b-41d4-a716-446655440000";
    const upsertBasketLine = vi.fn(async (input: UpsertBasketLineInput) => {
      expect("productVariantId" in input ? input.productVariantId : null).toBe(variantId);
      expect(input.quantity).toBe(1);
      return sampleBasket({
        lines: [
          {
            lineId: "line-merch",
            artworkId: null,
            artworkSlug: null,
            artworkTitle: null,
            productVariantId: variantId,
            productSlug: "lax-cap",
            productTitle: "LAX Cap",
            variantSku: "CAP-001",
            unitPricePence: 2500,
            livePricePence: 2500,
            quantity: 1,
            sellableCount: 8,
            imageUrl: null,
          },
        ],
      });
    });
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        merchandiseEnabled: true,
        upsertBasketLine,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers: {
        authorization: `Bearer ${BFF_TOKEN}`,
        "x-shop-basket-token": BASKET_TOKEN,
        "content-type": "application/json",
      },
      payload: { productVariantId: variantId, quantity: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(upsertBasketLine).toHaveBeenCalledOnce();
    await app.close();
  });

  it("returns 400 when artwork and variant are both provided", async () => {
    const upsertBasketLine = vi.fn();
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        merchandiseEnabled: true,
        upsertBasketLine,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers: {
        authorization: `Bearer ${BFF_TOKEN}`,
        "x-shop-basket-token": BASKET_TOKEN,
        "content-type": "application/json",
      },
      payload: {
        artworkSlug: "warm-basket",
        productVariantId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "shop.validation" });
    expect(upsertBasketLine).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 400 when neither artwork nor variant is provided", async () => {
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        merchandiseEnabled: true,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers: {
        authorization: `Bearer ${BFF_TOKEN}`,
        "x-shop-basket-token": BASKET_TOKEN,
        "content-type": "application/json",
      },
      payload: { quantity: 1 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "shop.validation" });
    await app.close();
  });

  it("returns feature_disabled when variant upsert is sent but merchandise flag is off", async () => {
    const upsertBasketLine = vi.fn();
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        merchandiseEnabled: false,
        upsertBasketLine,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers: {
        authorization: `Bearer ${BFF_TOKEN}`,
        "x-shop-basket-token": BASKET_TOKEN,
        "content-type": "application/json",
      },
      payload: {
        productVariantId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 1,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "shop.feature_disabled" });
    expect(upsertBasketLine).not.toHaveBeenCalled();
    await app.close();
  });
});
