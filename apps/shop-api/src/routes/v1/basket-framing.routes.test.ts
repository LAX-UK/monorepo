import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import type {
  BasketRecord,
  UpsertBasketLineInput,
} from "../../application/ports/commerce.ports.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import {
  BLACK,
  OAK,
  editionFacts,
  fixedFramingReader,
  liveOption,
} from "../../test-support/in-memory-edition-framing.js";

const BFF_TOKEN = "test-bff-token-minimum-32-characters-long";
const BASKET_TOKEN = "guest-basket-token-value-0123456789";
const LINE = "00000000-0000-4000-8000-0000000000c1";
const headers = {
  authorization: `Bearer ${BFF_TOKEN}`,
  "x-shop-basket-token": BASKET_TOKEN,
  "content-type": "application/json",
};

const oak = liveOption(OAK, { name: "Natural oak frame" });

function framedBasket(quantity = 2): BasketRecord {
  return {
    basketId: "basket-1",
    owner: { kind: "anonymous", tokenHash: "abc" },
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    lines: [
      {
        lineId: LINE,
        artworkId: "art-1",
        artworkSlug: "tide-line",
        artworkTitle: "Tide line",
        productVariantId: null,
        productSlug: null,
        productTitle: null,
        variantSku: null,
        unitPricePence: 18000,
        livePricePence: 18000,
        quantity,
        sellableCount: 5,
        imageUrl: null,
        artistName: null,
        artistSlug: null,
        editionSize: null,
        editionLine: null,
        framingOptionId: OAK,
        framing: {
          optionId: OAK,
          name: "Natural oak frame",
          frame: "natural_oak",
          mount: "window_conservation",
          glazing: "uv_acrylic",
          hanging: "d_rings_cord",
          pricePence: 21000,
          leadTimeMinDays: 10,
          leadTimeMaxDays: 15,
          available: true,
        },
      },
    ],
  };
}

async function appWith(commerce: Record<string, unknown>) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({ commerce: { ...base.commerce, ...commerce } }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("basket framing routes", () => {
  it("passes the chosen framing to the basket, and only the option id", async () => {
    const upsertBasketLine = vi.fn(async (_input: UpsertBasketLineInput) => framedBasket());
    const app = await appWith({ upsertBasketLine, framingEnabled: true });
    const response = await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers,
      payload: { artworkSlug: "tide-line", quantity: 2, framingOptionId: OAK },
    });
    expect(response.statusCode).toBe(200);
    expect(upsertBasketLine).toHaveBeenCalledWith(
      expect.objectContaining({ artworkSlug: "tide-line", framingOptionId: OAK }),
    );
    await app.close();
  });

  it("leaves the framing alone when the request does not mention it", async () => {
    const upsertBasketLine = vi.fn(async (_input: UpsertBasketLineInput) => framedBasket());
    const app = await appWith({ upsertBasketLine });
    await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers,
      payload: { artworkSlug: "tide-line", quantity: 1 },
    });
    expect(upsertBasketLine.mock.calls[0]?.[0]).not.toHaveProperty("framingOptionId");
    await app.close();
  });

  it("takes null to go unframed", async () => {
    const upsertBasketLine = vi.fn(async (_input: UpsertBasketLineInput) => framedBasket());
    const app = await appWith({ upsertBasketLine, framingEnabled: true });
    await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers,
      payload: { artworkSlug: "tide-line", quantity: 1, framingOptionId: null },
    });
    expect(upsertBasketLine.mock.calls[0]?.[0]).toHaveProperty("framingOptionId", null);
    await app.close();
  });

  it("refuses a framing id that is not a uuid", async () => {
    const app = await appWith({ framingEnabled: true });
    const response = await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers,
      payload: { artworkSlug: "tide-line", quantity: 1, framingOptionId: "oak" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("never takes a price from the buyer: anything but the option id is dropped", async () => {
    const upsertBasketLine = vi.fn(async (_input: UpsertBasketLineInput) => framedBasket());
    const app = await appWith({ upsertBasketLine, framingEnabled: true });
    await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers,
      payload: {
        artworkSlug: "tide-line",
        quantity: 1,
        framingOptionId: OAK,
        framingPricePence: 1,
      },
    });
    expect(upsertBasketLine.mock.calls[0]?.[0]).not.toHaveProperty("framingPricePence");
    expect(upsertBasketLine.mock.calls[0]?.[0]).toHaveProperty("framingOptionId", OAK);
    await app.close();
  });

  it("shows the framing on the line and adds it to the basket total, priced by the server", async () => {
    const app = await appWith({ getBasket: async () => framedBasket(2), framingEnabled: true });
    const response = await app.inject({
      method: "GET",
      url: "/v1/basket",
      headers: { authorization: `Bearer ${BFF_TOKEN}`, "x-shop-basket-token": BASKET_TOKEN },
    });
    const body = response.json() as {
      merchandiseSubtotalPence: number;
      framingSubtotalPence?: number;
      lines: { framing?: { name: string; pricePence: number } }[];
    };
    expect(body.merchandiseSubtotalPence).toBe(36000);
    expect(body.framingSubtotalPence).toBe(42000);
    expect(body.lines[0]?.framing).toMatchObject({ name: "Natural oak frame", pricePence: 21000 });
    await app.close();
  });

  it("leaves an unavailable framing out of the framing total", async () => {
    const basket = framedBasket(1);
    const line = basket.lines[0];
    if (line?.framing) line.framing = { ...line.framing, available: false };
    const app = await appWith({ getBasket: async () => basket });
    const response = await app.inject({
      method: "GET",
      url: "/v1/basket",
      headers: { authorization: `Bearer ${BFF_TOKEN}`, "x-shop-basket-token": BASKET_TOKEN },
    });
    const body = response.json() as { framingSubtotalPence?: number };
    expect(body.framingSubtotalPence).toBeUndefined();
    await app.close();
  });

  it("changes the framing on a line", async () => {
    const setBasketLineFraming = vi.fn(async () => framedBasket());
    const app = await appWith({ setBasketLineFraming, framingEnabled: true });
    const response = await app.inject({
      method: "PUT",
      url: `/v1/basket/lines/${LINE}/framing`,
      headers,
      payload: { framingOptionId: BLACK },
    });
    expect(response.statusCode).toBe(200);
    expect(setBasketLineFraming).toHaveBeenCalledWith(
      expect.objectContaining({ lineId: LINE, framingOptionId: BLACK }),
    );
    await app.close();
  });

  it("validates the line id and the body when changing framing", async () => {
    const app = await appWith({ framingEnabled: true });
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/v1/basket/lines/not-a-uuid/framing",
          headers,
          payload: { framingOptionId: null },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/basket/lines/${LINE}/framing`,
          headers,
          payload: {},
        })
      ).statusCode,
    ).toBe(400);
    await app.close();
  });
});

describe("public framing route", () => {
  async function publicApp(framingEnabled: boolean) {
    const base = createMinimalShopApiTestDeps();
    const facts = editionFacts({}, [{ option: oak, overridePence: 21000 }]);
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps({
        framing: { framingEnabled, reader: fixedFramingReader(facts, [oak]) },
        commerce: base.commerce,
      }),
      logger: false,
    });
    await app.ready();
    return app;
  }

  it("shows the options an edition offers, priced for its size", async () => {
    const app = await publicApp(true);
    const response = await app.inject({
      method: "GET",
      url: "/v1/artworks/tide-line/framing",
      headers: { authorization: `Bearer ${BFF_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      kind: "choose",
      required: false,
      options: [expect.objectContaining({ id: OAK, name: "Natural oak frame", pricePence: 21000 })],
    });
    await app.close();
  });

  it("shows nothing at all while framing is switched off", async () => {
    const app = await publicApp(false);
    const response = await app.inject({
      method: "GET",
      url: "/v1/artworks/tide-line/framing",
      headers: { authorization: `Bearer ${BFF_TOKEN}` },
    });
    expect(response.json()).toEqual({
      kind: "none",
      required: false,
      description: null,
      options: [],
    });
    await app.close();
  });
});
