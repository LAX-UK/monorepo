/** @vitest-environment jsdom */
import { ShopFooter } from "@/components/footer/shop-footer";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ShopFooter", () => {
  it("renders only actionable footer destinations", () => {
    render(<ShopFooter />);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Privacy notice" })).toBeNull();
    expect(screen.getByText(/London Art Exchange Ltd/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Join us" }).getAttribute("href")).toBe("/register");
  });

  it("renders account footer states distinctly", () => {
    const { rerender } = render(<ShopFooter accountState={{ kind: "authenticated" }} />);
    expect(screen.getByRole("link", { name: "Your account" }).getAttribute("href")).toBe(
      "/account",
    );

    rerender(<ShopFooter accountState={{ kind: "disabled", accountHref: "/account/disabled" }} />);
    expect(screen.getByRole("link", { name: "Account status" }).getAttribute("href")).toBe(
      "/account/disabled",
    );

    rerender(<ShopFooter accountState={{ kind: "unavailable" }} />);
    expect(screen.getByText("Sign-in status unavailable")).toBeTruthy();
  });

  it("links to approved shared LAX policies when Bid is configured", () => {
    render(
      <ShopFooter
        crossProductLinks={[
          {
            id: "bid",
            label: "LAX Bid",
            href: "https://lax.bid",
            current: false,
            external: true,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Privacy notice" }).getAttribute("href")).toBe(
      "https://lax.bid/privacy",
    );
    expect(screen.getByRole("link", { name: "Cookie policy" }).getAttribute("href")).toBe(
      "https://lax.bid/cookies",
    );
  });
});
