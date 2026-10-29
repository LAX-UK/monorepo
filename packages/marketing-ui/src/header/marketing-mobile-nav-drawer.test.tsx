import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MarketingMegaNavSection } from "./marketing-header-mega-nav.js";
import { MarketingMobileNavDrawer } from "./marketing-mobile-nav-drawer.js";

function renderDrawer(sections: readonly MarketingMegaNavSection[]) {
  render(
    <MarketingMobileNavDrawer
      open
      onOpenChange={() => {}}
      resetKey="/"
      logo={<span>LAX</span>}
      sections={sections}
      isSectionActive={() => false}
      topSlot={<nav aria-label="Main menu">Flat menu</nav>}
    />,
  );
}

describe("MarketingMobileNavDrawer", () => {
  it("omits the sections landmark when a product passes no sections", () => {
    renderDrawer([]);
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Mobile primary" })).toBeNull();
  });

  it("renders accordion sections inside the primary landmark", () => {
    renderDrawer([{ id: "buy", label: "Buy", items: [{ label: "Sales", href: "/sales" }] }]);
    const nav = screen.getByRole("navigation", { name: "Mobile primary" });
    expect(nav.textContent).toContain("Buy");
  });

  it("lists every LAX product and LAX Account, marking the current one, since the top bar is hidden on phones", () => {
    render(
      <MarketingMobileNavDrawer
        open
        onOpenChange={() => {}}
        resetKey="/"
        logo={<span>LAX</span>}
        sections={[]}
        isSectionActive={() => false}
        familyLinks={[
          { id: "art", label: "lax.art", href: "https://lax.art", current: false },
          { id: "shop", label: "lax.shop", href: "https://shop.lax.art", current: false },
          { id: "bid", label: "lax.bid", href: "https://lax.bid", current: true },
          { id: "account", label: "LAX Account", href: "https://account.lax.bid", current: false },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "LAX family menu" });
    expect(Array.from(nav.querySelectorAll("a")).map((link) => link.textContent)).toEqual([
      "lax.art",
      "lax.shop",
      "lax.bidYou're here",
      "LAX Account",
    ]);
  });
});
