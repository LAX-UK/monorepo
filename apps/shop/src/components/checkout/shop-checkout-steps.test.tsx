/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShopCheckoutSteps } from "./shop-checkout-steps";

describe("ShopCheckoutSteps", () => {
  afterEach(cleanup);

  it("marks the current step and links back to the basket once it is done", () => {
    render(<ShopCheckoutSteps current="Details" />);
    const items = within(
      screen.getByRole("navigation", { name: "Checkout progress" }),
    ).getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([
      null,
      "step",
      null,
      null,
    ]);
    const basket = screen.getByRole("link", { name: "Basket (done)" });
    expect(basket.getAttribute("href")).toBe("/basket");
  });

  it("links nothing back once the order is placed", () => {
    render(<ShopCheckoutSteps current="Confirmation" />);
    expect(screen.queryAllByRole("link")).toEqual([]);
  });
});
