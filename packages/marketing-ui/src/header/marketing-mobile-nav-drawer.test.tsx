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
});
