import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import type { ShopFetchResult } from "@/lib/shop-fetch-result";
import {
  type BasketView,
  type OrderSummary,
  parseBasketResponse,
  parseOrderList,
  parseOrderSummary,
} from "@auction/shop-contracts";
import { cache } from "react";

async function fetchShopBasketUncached(): Promise<ShopFetchResult<BasketView>> {
  try {
    const response = await shopCommerceRequest("/commerce/basket", {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) return { status: "unauthorized" };
    if (!response.ok) return { status: "failed" };
    const parsed = parseBasketResponse(await response.json());
    if (parsed.basketId === null) {
      return { status: "empty" };
    }
    return { status: "ok", data: parsed };
  } catch {
    return { status: "failed" };
  }
}

export const fetchShopBasket = cache(fetchShopBasketUncached);

export async function fetchShopOrder(orderId: string): Promise<ShopFetchResult<OrderSummary>> {
  try {
    const response = await shopCommerceRequest(`/commerce/orders/${encodeURIComponent(orderId)}`, {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) return { status: "unauthorized" };
    if (response.status === 404) return { status: "empty" };
    if (!response.ok) return { status: "failed" };
    return { status: "ok", data: parseOrderSummary(await response.json()) };
  } catch {
    return { status: "failed" };
  }
}

export async function listShopOrders(): Promise<ShopFetchResult<OrderSummary[]>> {
  try {
    const response = await shopCommerceRequest("/commerce/orders", {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) return { status: "unauthorized" };
    if (!response.ok) return { status: "failed" };
    const { items } = parseOrderList(await response.json());
    if (items.length === 0) return { status: "empty" };
    return { status: "ok", data: items };
  } catch {
    return { status: "failed" };
  }
}

export { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
