/** @vitest-environment jsdom */
import {
  ShopAuthenticatedAccountMenu,
  ShopGuestAccountMenu,
} from "@/components/header/shop-header-account-menu";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

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

describe("Shop account menus", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists guest sign-in and create account destinations", () => {
    render(
      <ShopGuestAccountMenu
        loginHref="https://identity.test/login"
        registerHref="/register"
        headerTone="on-light"
        initialOpen
      />,
    );
    expect(screen.getByRole("menuitem", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login?returnTo=%2F",
    );
    expect(screen.getByRole("menuitem", { name: "Create account" }).getAttribute("href")).toBe(
      "/register",
    );
  });

  it("lists authenticated account destinations and LAX products", () => {
    render(
      <ShopAuthenticatedAccountMenu
        displayName="Alex Collector"
        email="alex@lax.bid"
        accountHref="/account"
        logoutHref="https://identity.test/logout"
        productLinks={productLinks}
        headerTone="on-light"
        initialOpen
      />,
    );
    expect(screen.getByText("alex@lax.bid")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "My account" }).getAttribute("href")).toBe(
      "/account",
    );
    expect(screen.getByRole("menuitem", { name: "Orders" }).getAttribute("href")).toBe(
      "/account/orders",
    );
    expect(screen.getByRole("menuitem", { name: "LAX Bid" }).getAttribute("href")).toBe(
      "http://localhost:3000",
    );
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("submits the hoisted logout form when Sign out is selected", () => {
    const logoutHref = "https://identity.test/logout";
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => {});

    render(
      <ShopAuthenticatedAccountMenu
        displayName="Alex Collector"
        email="alex@lax.bid"
        accountHref="/account"
        logoutHref={logoutHref}
        productLinks={[]}
        headerTone="on-light"
        initialOpen
      />,
    );

    const hiddenForm = document.querySelector(
      `form[action="${logoutHref}"][method="post"]`,
    ) as HTMLFormElement;
    expect(hiddenForm).toBeTruthy();
    expect(hiddenForm.hidden).toBe(true);

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(requestSubmit.mock.instances[0]).toBe(hiddenForm);

    requestSubmit.mockRestore();
  });

  it("honours controlled open state", () => {
    const { rerender } = render(
      <ShopGuestAccountMenu
        loginHref="https://identity.test/login"
        registerHref="/register"
        headerTone="on-light"
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.queryByRole("menuitem", { name: "Sign in" })).toBeNull();
    rerender(
      <ShopGuestAccountMenu
        loginHref="https://identity.test/login"
        registerHref="/register"
        headerTone="on-light"
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("menuitem", { name: "Sign in" })).toBeTruthy();
  });
});
