/** @vitest-environment jsdom */
import { ShopPageHeader, shopPageWayfinding } from "@/components/shop-page-header";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("ShopPageHeader", () => {
  it("renders linked ancestors and marks the current page in the trail", () => {
    render(<ShopPageHeader {...shopPageWayfinding.basket} />);

    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Shop" }).getAttribute("href")).toBe("/");
    const trail = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(trail.querySelector("[aria-current='page']")?.textContent).toBe("Basket");
    expect(screen.getByRole("heading", { level: 1, name: "Basket" })).toBeTruthy();
  });

  it("renders nested account order paths", () => {
    const wayfinding = shopPageWayfinding.orderDetail("a1b2c3d4…");
    render(<ShopPageHeader title={wayfinding.title} breadcrumbs={wayfinding.breadcrumbs} />);

    expect(screen.getByRole("link", { name: "Account" }).getAttribute("href")).toBe("/account");
    expect(screen.getByRole("link", { name: "Orders" }).getAttribute("href")).toBe(
      "/account/orders",
    );
    expect(screen.getByText("a1b2c3d4…").getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 1, name: "Order a1b2c3d4…" })).toBeTruthy();
  });
});
