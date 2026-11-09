import type { Database } from "@auction/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Both ways an order is made from a basket (the checkout, and the delivery-quote order) must
 * check framing through loadCheckoutBasket, on the lines the order is built from. These tests
 * run each entry point against a basket that reads as unframed the first time and framed with a
 * withdrawn frame the second, and expect the order to be refused.
 */

const loadBasketRecord = vi.fn();
vi.mock("./shop-basket.persistence.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./shop-basket.persistence.js")>()),
  loadBasketRecord,
  repriceBasketLinesIfNeeded: vi.fn(async () => false),
  assertBasketStock: vi.fn(async () => undefined),
}));

const readFacts = vi.fn(async () => new Map());
vi.mock("./framing/drizzle-edition-framing.store.js", () => ({
  createDrizzleEditionFramingReader: () => ({ read: readFacts }),
}));

const { loadCheckoutBasket } = await import("./shop-checkout-basket.js");
const { createDrizzleCheckoutRepository } = await import("./drizzle-checkout.repository.js");
const { createDrizzleDeliveryQuoteOrderStore } = await import(
  "./drizzle-delivery-quote-order.store.js"
);

const OAK = "00000000-0000-4000-8000-0000000000a1";
const ARTWORK = "00000000-0000-4000-8000-0000000000b1";
const owner = { kind: "anonymous" as const, tokenHash: "hash" };

const printLine = {
  lineId: "line-1",
  artworkId: ARTWORK,
  artworkSlug: "tide-line",
  artworkTitle: "Tide line",
  productVariantId: null,
  productSlug: null,
  productTitle: null,
  variantSku: null,
  unitPricePence: 18000,
  livePricePence: 18000,
  quantity: 1,
  sellableCount: 3,
  imageUrl: null,
  artistName: null,
  artistSlug: null,
  editionSize: null,
  editionLine: null,
};

const firstRead = { basketId: "b", owner, expiresAt: new Date("2030-01-01"), lines: [printLine] };
const withdrawn = {
  ...printLine,
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
    available: false,
  },
};
const freshRead = { ...firstRead, lines: [withdrawn] };

/** A database that answers every query with no rows, so the code under test reaches the basket. */
function emptyDb(): Database {
  const chain: unknown = new Proxy(() => chain, {
    get: (_target, property) =>
      property === "then" ? (resolve: (rows: unknown[]) => void) => resolve([]) : chain,
    apply: () => chain,
  });
  return chain as Database;
}

const gateway = {} as never;

beforeEach(() => {
  loadBasketRecord.mockReset();
  loadBasketRecord.mockResolvedValueOnce(firstRead).mockResolvedValueOnce(freshRead);
  readFacts.mockClear();
});

describe("loadCheckoutBasket", () => {
  it("checks framing on the lines the order is built from, not the first read", async () => {
    await expect(
      loadCheckoutBasket(
        emptyDb(),
        { basketId: "b", ownedBy: () => true },
        { merchandiseEnabled: false, framingEnabled: true },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("no longer offered"),
    });
    // Both reads happened, and the second is the one that was refused.
    expect(loadBasketRecord).toHaveBeenCalledTimes(2);
  });

  it("takes frames out of the basket and says so while framing is switched off", async () => {
    await expect(
      loadCheckoutBasket(
        emptyDb(),
        { basketId: "b", ownedBy: () => true },
        { merchandiseEnabled: false, framingEnabled: false },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("frames were removed from your basket"),
    });
  });

  it("returns the goods and the framing apart when the frame is on offer", async () => {
    loadBasketRecord.mockReset();
    const offered = { ...withdrawn, framing: { ...withdrawn.framing, available: true } };
    loadBasketRecord
      .mockResolvedValueOnce(firstRead)
      .mockResolvedValueOnce({ ...firstRead, lines: [{ ...offered, quantity: 2 }] });
    const basket = await loadCheckoutBasket(
      emptyDb(),
      { basketId: "b", ownedBy: () => true },
      { merchandiseEnabled: false, framingEnabled: true },
    );
    expect(basket.merchandiseSubtotal).toBe(36000);
    expect(basket.framingSubtotal).toBe(42000);
  });
});

describe("both order paths go through it", () => {
  it("the checkout", async () => {
    const repository = createDrizzleCheckoutRepository(emptyDb(), gateway, {
      storefrontUrl: "https://shop.test",
      domainEventMode: "off",
      framingEnabled: true,
    });
    await expect(
      repository.createCheckoutOrder({
        subject: "subject-1",
        guest: { guestCustomerId: "g", basketTokenHash: "hash" },
        basketId: "b",
        fulfilment: "collect_new_cavendish",
        idempotencyKey: "key-1",
        successUrl: "https://shop.test/ok",
        cancelUrl: "https://shop.test/cancel",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("no longer offered"),
    });
    expect(loadBasketRecord).toHaveBeenCalledTimes(2);
  });

  it("the delivery-quote order", async () => {
    const store = createDrizzleDeliveryQuoteOrderStore(emptyDb(), {
      domainEventMode: "off",
      framingEnabled: true,
      notifications: { queueDeliveryQuoteRequested: vi.fn() },
    });
    await expect(
      store.createQuoteOrder({
        subject: "subject-1",
        guest: { guestCustomerId: "g", basketTokenHash: "hash" },
        guestIpHash: null,
        basketId: "b",
        idempotencyKey: "key-2",
        deliveryAddress: {
          line1: "1 Main Street",
          city: "New York",
          postcode: "10011",
          country: "US",
        },
        regionId: "north_america",
        country: "US",
        status: "requested",
        holdUntil: new Date("2030-01-01"),
        fallbackEmail: null,
      } as never),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("no longer offered"),
    });
    expect(loadBasketRecord).toHaveBeenCalledTimes(2);
  });
});
