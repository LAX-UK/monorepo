/** @vitest-environment jsdom */
import { ShopHeaderClient } from "@/components/header/shop-header.client";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";

const productLinks: LaxProductLinkVm[] = [
  {
    id: "shop",
    label: "LAX Shop",
    href: "http://localhost:3020",
    current: true,
    external: false,
  },
  {
    id: "bid",
    label: "LAX Bid",
    href: "http://localhost:3000",
    current: false,
    external: true,
  },
];

describe("ShopHeaderClient", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes guest account menu with sign-in and create account destinations", async () => {
    render(
      <ShopHeaderClient
        account={{
          kind: "guest",
          loginHref: "https://identity.test/login",
          registerHref: "/register",
        }}
        productLinks={productLinks}
        basketCount={0}
      />,
    );
    const basketLink = screen.getByRole("link", { name: "Basket, empty" });
    expect(basketLink.getAttribute("href")).toBe("/basket");
    expect(screen.queryByRole("navigation", { name: "Utility" })).toBeNull();
    const accountMenu = screen.getByRole("button", { name: "Account menu" });
    expect(accountMenu.getAttribute("aria-haspopup")).toBe("menu");
    expect(screen.getByRole("navigation", { name: "LAX products" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Switch to dark theme" }).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole("link", { name: "FAQs" })).toBeNull();

    const header = screen.getByTestId("shop-header");
    expect(header.getAttribute("data-header-tone")).toBe("on-dark");
    const collectTrigger = screen.getByRole("button", { name: "Collect" });
    expect(collectTrigger.getAttribute("aria-haspopup")).toBe("true");
    fireEvent.click(collectTrigger);
    expect(collectTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(header.getAttribute("data-header-tone")).toBe("on-light");
    expect(header.className).toContain("shadow-none");
    expect(screen.getByRole("link", { name: "View all artworks" })).toBeTruthy();
    const desktopAccount = within(screen.getByTestId("shop-header-desktop-account")).getByRole(
      "button",
      { name: "Account menu" },
    );
    fireEvent.pointerDown(desktopAccount, { button: 0, pointerType: "mouse" });
    fireEvent.click(desktopAccount);
    await waitFor(() => expect(collectTrigger.getAttribute("aria-expanded")).toBe("false"));
    fireEvent.click(collectTrigger);
    await waitFor(() => expect(collectTrigger.getAttribute("aria-expanded")).toBe("true"));
    collectTrigger.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(collectTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(collectTrigger);
    expect(header.getAttribute("data-header-tone")).toBe("on-dark");

    fireEvent.click(screen.getByRole("button", { name: "Artists" }));
    expect(screen.getByRole("link", { name: "View all artists" })).toBeTruthy();

    const menu = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.querySelector(".shop-header__mobile-account")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows authenticated account dropdown with orders and product links", () => {
    render(
      <ShopHeaderClient
        account={{
          kind: "authenticated",
          displayName: "Alex Collector",
          email: "alex@lax.bid",
          accountHref: "/account",
          logoutHref: "https://identity.test/logout",
        }}
        productLinks={productLinks}
        basketCount={2}
      />,
    );
    expect(screen.getAllByRole("link", { name: "Basket, 2 items" }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByRole("button", { name: "Account menu" }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("Alex Collector")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("link", { name: "My account" })).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: "Account menu" })).toBeNull();
  });

  it("shows compact disabled status with details link", () => {
    const { container } = render(
      <ShopHeaderClient
        account={{
          kind: "disabled",
          message: "Your LAX account is disabled. Contact support for help.",
          accountHref: "/account/disabled",
        }}
        productLinks={[]}
        basketCount={0}
      />,
    );
    const view = within(container);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(
      within(screen.getByRole("dialog")).getAllByText("Account restricted").length,
    ).toBeGreaterThan(0);
    expect(
      within(screen.getByRole("dialog"))
        .getByRole("link", { name: /Account restricted/i })
        .getAttribute("href"),
    ).toBe("/account/disabled");
    expect(view.getAllByText(/Contact support for help/).length).toBeGreaterThan(0);
  });

  it("shows compact unavailable status without guest actions", () => {
    const { container } = render(
      <ShopHeaderClient
        account={{
          kind: "unavailable",
          message: "We could not verify your sign-in status. Try again in a moment.",
        }}
        productLinks={[]}
        basketCount={0}
      />,
    );
    const view = within(container);
    expect(view.queryByRole("button", { name: "Account menu" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Why sign-in is unavailable",
      }),
    ).toBeTruthy();
  });
});
