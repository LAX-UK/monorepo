/** @vitest-environment jsdom */
import { ShopHeaderAccountUtility } from "@/components/header/shop-header-account-utility";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/artworks",
}));

describe("ShopHeaderAccountUtility", () => {
  afterEach(cleanup);

  it("shows 'Account' when signed out", () => {
    render(
      <ShopHeaderAccountUtility
        account={{ kind: "guest", loginHref: "/login", registerHref: "/register" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Account menu" }).textContent).toBe("Account");
  });

  it("shows the first name only when signed in", () => {
    render(
      <ShopHeaderAccountUtility
        account={
          {
            kind: "authenticated",
            displayName: "Alex Collector",
            email: "alex@lax.bid",
            logoutHref: "/logout",
          } as never
        }
      />,
    );
    expect(screen.getByTestId("account-entry-name").textContent).toBe("Alex");
    expect(screen.queryByText("Alex Collector")).toBeNull();
  });

  it("shows a dot while an order needs action", () => {
    render(
      <ShopHeaderAccountUtility
        attention
        account={
          {
            kind: "authenticated",
            displayName: "Alex Collector",
            email: "alex@lax.bid",
            logoutHref: "/logout",
          } as never
        }
      />,
    );
    expect(screen.getByTestId("account-entry-attention")).toBeTruthy();
  });

  it("lists only Your orders, LAX Account settings and Sign out when open", () => {
    render(
      <ShopHeaderAccountUtility
        open
        onOpenChange={() => {}}
        account={
          {
            kind: "authenticated",
            displayName: "Alex Collector",
            email: "alex@lax.bid",
            logoutHref: "https://identity.test/logout",
          } as never
        }
      />,
    );
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Your orders",
      "LAX Account settings",
      "Sign out",
    ]);
    expect(screen.getByRole("menuitem", { name: "Your orders" }).getAttribute("href")).toBe(
      "/account/orders",
    );
  });

  it("offers Sign in (returning to the page) and Create account when signed out and open", () => {
    render(
      <ShopHeaderAccountUtility
        open
        onOpenChange={() => {}}
        account={{ kind: "guest", loginHref: "/login", registerHref: "/register" }}
      />,
    );
    expect(screen.getByRole("menuitem", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login?returnTo=%2Fartworks",
    );
    expect(screen.getByRole("menuitem", { name: "Create account" }).getAttribute("href")).toBe(
      "/register",
    );
  });
});
