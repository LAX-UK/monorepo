import { ShopBottomBar } from "@/components/header/shop-bottom-bar.client";
/** @vitest-environment jsdom */
import { buildShopBottomTabs, shopBottomBarHidden } from "@/components/header/shop-bottom-tabs";
import { isTabCurrent } from "@auction/marketing-ui";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const base = {
  basketCount: 0,
  accountNeedsAction: false,
  viewer: null,
  signInHref: "/login?returnTo=%2Fartworks",
};

function currentTabKey(pathname: string): string | undefined {
  return buildShopBottomTabs(base).find((tab) => isTabCurrent(tab, pathname))?.key;
}

describe("Shop bottom tabs", () => {
  afterEach(cleanup);

  it("lists Home, Shop, Search, Basket and Account in order", () => {
    expect(buildShopBottomTabs(base).map((tab) => tab.label)).toEqual([
      "Home",
      "Shop",
      "Search",
      "Basket",
      "Account",
    ]);
  });

  it("marks Shop current on artworks, categories, artists and merchandise", () => {
    for (const path of [
      "/artworks",
      "/artworks/some-edition",
      "/categories/prints",
      "/artists/jane-doe",
      "/merchandise",
      "/merchandise/tote",
    ]) {
      expect(currentTabKey(path), path).toBe("shop");
    }
  });

  it("marks Home on / only, Basket on /basket and Account beneath /account", () => {
    expect(currentTabKey("/")).toBe("home");
    expect(currentTabKey("/basket")).toBe("basket");
    expect(currentTabKey("/account/orders/o1")).toBe("account");
    expect(currentTabKey("/delivery")).toBeUndefined();
    expect(currentTabKey("/artworks-archive")).toBeUndefined();
  });

  it("makes Search an action, not a link", () => {
    const search = buildShopBottomTabs(base).find((tab) => tab.key === "search");
    expect(search?.action).toBe("search");
    expect(search?.href).toBeUndefined();
  });

  it("shows the basket count, and 9+ above nine, for guests too", () => {
    const badge = (count: number) =>
      buildShopBottomTabs({ ...base, basketCount: count }).find((tab) => tab.key === "basket")
        ?.badge;
    expect(badge(0)).toBeNull();
    expect(badge(3)).toEqual({ kind: "count", count: 3 });
    expect(badge(12)).toEqual({ kind: "count", count: 12 });
  });

  it("sends a signed-out Account tab to Sign in, returning to the page", () => {
    const account = buildShopBottomTabs(base).find((tab) => tab.key === "account");
    expect(account?.href).toBe("/login?returnTo=%2Fartworks");
    expect(account?.badge).toBeNull();
  });

  it("sends a signed-in Account tab to /account, with a dot only when an order needs action", () => {
    const tab = (needs: boolean) =>
      buildShopBottomTabs({
        ...base,
        viewer: { displayName: "Alex Collector", email: "alex@example.com" },
        accountNeedsAction: needs,
      }).find((t) => t.key === "account");
    expect(tab(false)?.href).toBe("/account");
    expect(tab(false)?.badge).toBeNull();
    expect(tab(true)?.badge).toEqual({ kind: "dot" });
  });

  it("has no bottom bar on checkout and payment routes", () => {
    expect(shopBottomBarHidden("/checkout")).toBe(true);
    expect(shopBottomBarHidden("/checkout/confirmation")).toBe(true);
    expect(shopBottomBarHidden("/checkout/cancel")).toBe(true);
    expect(shopBottomBarHidden("/checkoutish")).toBe(false);
    expect(shopBottomBarHidden("/basket")).toBe(false);
  });
});

describe("ShopBottomBar", () => {
  afterEach(cleanup);

  const props = { ...base, pathname: "/basket", onSearch: () => {} };

  it("shows the signed-in person's initials on the Account tab", () => {
    render(
      <ShopBottomBar
        {...props}
        viewer={{ displayName: "Alex Collector", email: "alex@example.com" }}
      />,
    );
    expect(screen.getByText("AC")).toBeTruthy();
  });

  it("renders the bar with the basket count, capped at 9+", () => {
    render(<ShopBottomBar {...props} basketCount={14} />);
    const bar = screen.getByTestId("marketing-bottom-tab-bar");
    expect(within(bar).getByTestId("tab-badge-Basket").textContent).toBe("9+");
    const basket = within(bar).getByRole("link", { name: /^Basket/ });
    expect(basket.getAttribute("aria-current")).toBe("page");
    expect(basket.getAttribute("href")).toBe("/basket");
  });

  it("shows the exact count up to nine", () => {
    render(<ShopBottomBar {...props} basketCount={9} />);
    expect(screen.getByTestId("tab-badge-Basket").textContent).toBe("9");
  });

  it("offers Sign in from the Account tab when signed out", () => {
    render(<ShopBottomBar {...props} pathname="/artworks" />);
    expect(screen.getByRole("link", { name: "Account" }).getAttribute("href")).toBe(
      "/login?returnTo=%2Fartworks",
    );
  });

  it("opens search from the Search tab", () => {
    const onSearch = vi.fn();
    render(<ShopBottomBar {...props} onSearch={onSearch} />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("draws nothing on checkout", () => {
    render(<ShopBottomBar {...props} pathname="/checkout" />);
    expect(screen.queryByTestId("marketing-bottom-tab-bar")).toBeNull();
    expect(document.documentElement.hasAttribute("data-lax-bottom-bar")).toBe(false);
  });
});
