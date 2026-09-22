/** @vitest-environment jsdom */
import { ShopHeaderBasketLink } from "@/components/header/shop-header-basket-link";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("ShopHeaderBasketLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("links to the basket route with an empty label when count is zero", () => {
    render(<ShopHeaderBasketLink itemCount={0} headerTone="on-light" />);
    const link = screen.getByRole("link", { name: "Basket, empty" });
    expect(link.getAttribute("href")).toBe("/basket");
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows a badge and plural label when count is greater than one", () => {
    render(<ShopHeaderBasketLink itemCount={2} headerTone="on-dark" />);
    expect(screen.getByRole("link", { name: "Basket, 2 items" })).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
});
