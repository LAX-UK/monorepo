/** @vitest-environment jsdom */
import { ShopMobileAuthSection } from "@/components/header/shop-mobile-auth-section";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

function renderMobileAuth(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/artworks",
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

describe("ShopMobileAuthSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders guest create account and sign in without account menu trigger", () => {
    const { container } = renderMobileAuth(
      <ShopMobileAuthSection
        account={{
          kind: "guest",
          loginHref: "https://identity.test/login",
          registerHref: "/register",
        }}
      />,
    );
    const footer = container.querySelector(".shop-header__mobile-account");
    expect(footer?.className.includes("w-full")).toBe(true);
    const createAccount = screen.getByRole("link", { name: "Create account" });
    expect(createAccount.className.includes("w-full")).toBe(true);
    expect(createAccount.getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login?returnTo=%2Fartworks",
    );
    expect(screen.queryByRole("button", { name: "Account menu" })).toBeNull();
  });

  it("renders authenticated links and sign out", () => {
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => {});
    renderMobileAuth(
      <ShopMobileAuthSection
        account={{
          kind: "authenticated",
          displayName: "Alex Collector",
          email: "alex@lax.bid",
          accountHref: "/account",
          logoutHref: "https://identity.test/logout",
        }}
        productLinks={productLinks}
      />,
    );
    expect(screen.getByText("Alex Collector")).toBeTruthy();
    expect(screen.getByRole("link", { name: "My account" }).getAttribute("href")).toBe("/account");
    expect(screen.getByRole("link", { name: "Orders" }).getAttribute("href")).toBe(
      "/account/orders",
    );
    expect(screen.getByRole("link", { name: "LAX Bid" }).getAttribute("href")).toBe(
      "http://localhost:3000",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(requestSubmit).toHaveBeenCalled();
    requestSubmit.mockRestore();
  });

  it("renders disabled account status", () => {
    renderMobileAuth(
      <ShopMobileAuthSection
        account={{
          kind: "disabled",
          message: "Account restricted",
          accountHref: "/account",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Account restricted/i })).toBeTruthy();
  });

  it("renders unavailable account status", () => {
    renderMobileAuth(
      <ShopMobileAuthSection
        account={{
          kind: "unavailable",
          message: "Sign-in unavailable",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Why sign-in is unavailable" })).toBeTruthy();
  });
});
