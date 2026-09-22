import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import type { BasketRecord } from "../../application/ports/commerce.ports.js";
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
        unitPricePence: 12000,
        livePricePence: 12000,
        quantity: 2,
        sellableCount: 5,
      },
    ],
    ...overrides,
  };
}

describe("basket routes", () => {
  it("parses JSON bodies on basket line upsert (not raw Buffer)", async () => {
    const upsertBasketLine = vi.fn(async (input: { artworkSlug: string; quantity: number }) => {
      expect(input.artworkSlug).toBe("warm-basket");
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
});
