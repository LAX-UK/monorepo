import { describe, expect, it } from "vitest";
import { shopBasketAccessibleLabel } from "./shop-basket-accessible-label.js";

describe("shopBasketAccessibleLabel", () => {
  it("describes empty, single, and plural baskets", () => {
    expect(shopBasketAccessibleLabel(0)).toBe("Basket, empty");
    expect(shopBasketAccessibleLabel(1)).toBe("Basket, 1 item");
    expect(shopBasketAccessibleLabel(3)).toBe("Basket, 3 items");
  });
});
