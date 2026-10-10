/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/artworks",
}));

import { ShopMobileAuthSection } from "@/components/header/shop-mobile-auth-section";

const guest = { kind: "guest", loginHref: "/login", registerHref: "/register" } as const;

function preventNavigation(event: Event) {
  event.preventDefault();
}

describe("ShopMobileAuthSection guest actions", () => {
  afterEach(() => {
    cleanup();
    document.removeEventListener("click", preventNavigation);
  });

  it("keeps the drawer open and shows progress after tapping Sign in", () => {
    document.addEventListener("click", preventNavigation);
    const onNavigate = vi.fn();
    render(<ShopMobileAuthSection account={guest} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("link", { name: "Sign in" }));

    const pending = screen.getByRole("link", { name: "Signing in…" });
    expect(pending.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("clears the pending state when the page is restored from the back-forward cache", () => {
    document.addEventListener("click", preventNavigation);
    render(<ShopMobileAuthSection account={guest} />);

    fireEvent.click(screen.getByRole("link", { name: "Create account" }));
    expect(screen.getByRole("link", { name: "Opening…" })).toBeTruthy();

    const restored = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(restored, "persisted", { value: true });
    fireEvent(window, restored);

    expect(screen.getByRole("link", { name: "Create account" })).toBeTruthy();
  });
});
