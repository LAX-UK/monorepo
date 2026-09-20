import * as shopCommerceRequestModule from "@/lib/shop-commerce-request.server";
import {
  parseBasketResponse,
  parseBasketView,
  parseOrderList,
  parseOrderSummary,
} from "@auction/shop-contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

import { fetchShopBasket, fetchShopOrder, listShopOrders } from "@/lib/shop-commerce.server";

const basketFixture = {
  basketId: "550e8400-e29b-41d4-a716-846655440000",
  lines: [],
  merchandiseSubtotalPence: 0,
  expiresAt: "2026-01-01T00:00:00.000Z",
};

const orderFixture = {
  orderId: "550e8400-e29b-41d4-a716-846655440001",
  status: "paid" as const,
  fulfilment: "uk_insured_delivery" as const,
  merchandiseSubtotalPence: 100,
  fulfilmentSurchargePence: 0,
  totalPence: 100,
  createdAt: "2026-01-01T00:00:00.000Z",
  paidAt: "2026-01-01T00:01:00.000Z",
  deliveryAddress: null,
  lines: [],
};

describe("shop commerce reads", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses contract-valid commerce fixtures", () => {
    expect(parseBasketView(basketFixture).basketId).toBe(basketFixture.basketId);
    expect(parseBasketResponse(basketFixture).basketId).toBe(basketFixture.basketId);
    expect(parseOrderSummary(orderFixture).orderId).toBe(orderFixture.orderId);
    expect(parseOrderList({ items: [] }).items).toEqual([]);
  });

  it("maps basket ok, empty, unauthorized, and failed", async () => {
    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockResolvedValueOnce(
      new Response(JSON.stringify(basketFixture), { status: 200 }),
    );
    await expect(fetchShopBasket()).resolves.toMatchObject({ status: "ok" });

    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          basketId: null,
          lines: [],
          merchandiseSubtotalPence: 0,
          expiresAt: null,
        }),
        { status: 200 },
      ),
    );
    await expect(fetchShopBasket()).resolves.toEqual({ status: "empty" });

    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockResolvedValueOnce(
      new Response("", { status: 401 }),
    );
    await expect(fetchShopBasket()).resolves.toEqual({ status: "unauthorized" });

    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockRejectedValueOnce(
      new Error("network"),
    );
    await expect(fetchShopBasket()).resolves.toEqual({ status: "failed" });
  });

  it("maps order and list outcomes including unauthorized", async () => {
    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockResolvedValueOnce(
      new Response("", { status: 401 }),
    );
    await expect(fetchShopOrder("ord-1")).resolves.toEqual({ status: "unauthorized" });

    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockResolvedValueOnce(
      new Response("", { status: 404 }),
    );
    await expect(fetchShopOrder("ord-1")).resolves.toEqual({ status: "empty" });

    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockResolvedValueOnce(
      new Response(JSON.stringify(orderFixture), { status: 200 }),
    );
    await expect(fetchShopOrder("ord-1")).resolves.toMatchObject({ status: "ok" });

    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockResolvedValueOnce(
      new Response("{}", { status: 500 }),
    );
    await expect(listShopOrders()).resolves.toEqual({ status: "failed" });

    vi.spyOn(shopCommerceRequestModule, "shopCommerceRequest").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    await expect(listShopOrders()).resolves.toEqual({ status: "empty" });
  });
});
