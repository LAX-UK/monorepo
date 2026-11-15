import type { Database } from "@auction/db";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * An order never holds more copies of one edition than the order limit, whatever the basket
 * says: the add-to-basket check cannot see a basket made before the limit was lowered.
 */

const loadBasketRecord = vi.fn();
vi.mock("./shop-basket.persistence.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./shop-basket.persistence.js")>()),
  loadBasketRecord,
  repriceBasketLinesIfNeeded: vi.fn(async () => false),
  assertBasketStock: vi.fn(async () => undefined),
}));

const { loadCheckoutBasket } = await import("./shop-checkout-basket.js");

const owner = { kind: "anonymous" as const, tokenHash: "hash" };
const line = (quantity: number, artworkId: string | null = "a1") => ({
  lineId: "l1",
  artworkId,
  productVariantId: artworkId ? null : "v1",
  unitPricePence: 18000,
  livePricePence: 18000,
  framingOptionId: null,
  framingPricePence: null,
  framing: null,
  quantity,
  sellableCount: 10,
});
const basket = (quantity: number, artworkId: string | null = "a1") => ({
  basketId: "b",
  owner,
  expiresAt: new Date("2030-01-01"),
  lines: [line(quantity, artworkId)],
});
const db = {} as Database;
const input = { basketId: "b", ownedBy: () => true };

function load(quantity: number, editionOrderLimit: number | null, artworkId: string | null = "a1") {
  loadBasketRecord.mockReset();
  loadBasketRecord.mockResolvedValue(basket(quantity, artworkId));
  return loadCheckoutBasket(db, input, {
    merchandiseEnabled: true,
    framingEnabled: false,
    editionOrderLimit,
  });
}

beforeEach(() => loadBasketRecord.mockReset());

describe("loadCheckoutBasket edition order limit", () => {
  it("refuses a third copy of one edition in an order", async () => {
    await expect(load(3, 2)).rejects.toMatchObject({
      code: SHOP_API_ERROR_CODES.QUANTITY_LIMIT,
      statusCode: 409,
      message: "Limit 2 per order",
    });
  });

  it("takes two copies, the limit itself", async () => {
    await expect(load(2, 2)).resolves.toMatchObject({ lines: [{ quantity: 2 }] });
  });

  it("follows a different limit, so an override still wins", async () => {
    await expect(load(3, 4)).resolves.toBeDefined();
    await expect(load(5, 4)).rejects.toMatchObject({ code: SHOP_API_ERROR_CODES.QUANTITY_LIMIT });
  });

  it("leaves only the stock when the limit is off", async () => {
    await expect(load(9, null)).resolves.toBeDefined();
  });

  it("does not apply to merchandise lines", async () => {
    await expect(load(5, 2, null)).resolves.toBeDefined();
  });
});
