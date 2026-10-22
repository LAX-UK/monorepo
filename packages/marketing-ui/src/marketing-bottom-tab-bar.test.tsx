import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingBottomTabBar } from "./marketing-bottom-tab-bar.js";

describe("MarketingBottomTabBar", () => {
  it("marks only the active tab as the current page", () => {
    render(
      <MarketingBottomTabBar
        items={[
          { href: "/", label: "Home", active: false },
          { href: "/artworks", label: "Artworks", active: true },
          { href: "/account", label: "Account", active: false },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Mobile" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(within(nav).getByRole("link", { name: "Artworks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("lays tabs out in equal columns with 56px tap targets", () => {
    render(
      <MarketingBottomTabBar
        ariaLabel="Art"
        items={[
          { href: "/", label: "Home", active: true },
          { href: "/search", label: "Search", active: false },
        ]}
      />,
    );
    const list = screen.getByRole("list");
    expect(list.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(screen.getByRole("link", { name: "Search" }).className).toContain("min-h-14");
  });

  it("keeps the full-width bar by default", () => {
    render(<MarketingBottomTabBar items={[{ href: "/", label: "Home", active: true }]} />);
    const nav = screen.getByRole("navigation", { name: "Mobile" });
    expect(nav).toHaveAttribute("data-variant", "default");
    expect(nav.className).toContain("inset-x-0");
    expect(nav.className).toContain("border-t");
  });

  it("floats as an inset, safe-area aware pill with a filled active tab", () => {
    render(
      <MarketingBottomTabBar
        variant="floating"
        items={[
          { href: "/", label: "Home", active: true },
          { href: "/account", label: "Account", active: false },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Mobile" });
    expect(nav).toHaveAttribute("data-variant", "floating");
    expect(nav.className).toContain("inset-x-4");
    expect(nav.className).toContain("rounded-full");
    expect(nav.className).toContain("safe-area-inset-bottom");
    const home = screen.getByRole("link", { name: "Home" });
    expect(home.className).toContain("bg-surface-container-high");
    expect(home.className).toContain("min-h-14");
    expect(screen.getByRole("link", { name: "Account" }).className).not.toContain(
      "bg-surface-container-high",
    );
  });
});
