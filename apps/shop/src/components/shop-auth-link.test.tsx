/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShopAuthLink } from "./shop-auth-link";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={String(prefetch ?? true)}>
      {children}
    </a>
  ),
}));

describe("ShopAuthLink", () => {
  it("renders a plain anchor for auth-start hrefs", () => {
    render(<ShopAuthLink href="/login?returnTo=%2F">Sign in</ShopAuthLink>);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("data-prefetch")).toBeNull();
    expect(link.getAttribute("href")).toBe("/login?returnTo=%2F");
  });

  it("uses Link with prefetch disabled for non-auth hrefs", () => {
    render(<ShopAuthLink href="/account">Account</ShopAuthLink>);
    const link = screen.getByRole("link", { name: "Account" });
    expect(link.getAttribute("data-prefetch")).toBe("false");
  });
});
