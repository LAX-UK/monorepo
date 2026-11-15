/** @vitest-environment jsdom */
import { ShopHeaderClient } from "@/components/header/shop-header.client";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/artworks",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ShopHeaderClient phone menu", () => {
  afterEach(cleanup);

  it("lists the basket with its count and the signed-in orders page", () => {
    render(
      <ShopHeaderClient
        account={{ kind: "guest", loginHref: "/login", registerHref: "/register" }}
        basketCount={3}
        merchandiseEnabled={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const nav = within(screen.getByRole("dialog")).getByRole("navigation", {
      name: "Shop shortcuts",
    });
    const basket = within(nav).getByRole("link", { name: "Basket 3 items" });
    expect(basket.getAttribute("href")).toBe("/basket");
    expect(within(nav).getByRole("link", { name: "Orders" }).getAttribute("href")).toBe(
      "/account/orders",
    );
  });
});
