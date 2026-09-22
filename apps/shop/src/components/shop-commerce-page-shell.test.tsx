/** @vitest-environment jsdom */
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("ShopCommercePageShell", () => {
  it("keeps the page header outside the narrow commerce content column", () => {
    render(
      <ShopCommercePageShell header={shopPageWayfinding.basket} contentClassName="shop-basket">
        <p>Basket body</p>
      </ShopCommercePageShell>,
    );

    const page = screen.getByTestId("shop-commerce-page");
    const content = screen.getByTestId("shop-commerce-content");
    const header = screen.getByRole("heading", { level: 1, name: "Basket" });

    expect(page.contains(header)).toBe(true);
    expect(page.contains(content)).toBe(true);
    expect(content.contains(header)).toBe(false);
    expect(content.className).toContain("shop-basket");
    expect(screen.getByText("Basket body")).toBeTruthy();
  });
});
