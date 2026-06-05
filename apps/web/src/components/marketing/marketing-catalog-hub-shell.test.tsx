import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MARKETING_CATALOG_PT } from "@/lib/marketing/chrome";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarketingCatalogHubShell", () => {
  it("renders main landmark with catalogue top padding and page background", () => {
    const { container } = render(
      <MarketingCatalogHubShell>
        <p>Catalogue body</p>
      </MarketingCatalogHubShell>,
    );

    const main = container.querySelector("#main-content");
    expect(main).not.toBeNull();
    expect(main?.className).toContain(MARKETING_CATALOG_PT);
    expect(main?.className).toMatch(/bg-page-bg/);
  });

  it("renders slots in order: jsonLd, hero, toolbar, children, footer", () => {
    const { container } = render(
      <MarketingCatalogHubShell
        jsonLd={<span data-testid="json-ld">ld</span>}
        hero={<header data-testid="hero">Hero</header>}
        toolbar={<div data-testid="toolbar">Toolbar</div>}
        footer={<nav data-testid="footer">Footer</nav>}
      >
        <section data-testid="children">Children</section>
      </MarketingCatalogHubShell>,
    );

    const main = container.querySelector("#main-content");
    const topLevelIds = Array.from(main?.children ?? []).map(
      (el) => el.getAttribute("data-testid") ?? el.tagName.toLowerCase(),
    );
    expect(topLevelIds).toEqual(["json-ld", "hero", "div"]);

    const shell = main?.children[2];
    const shellChildIds = Array.from(shell?.children ?? []).map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(shellChildIds).toEqual(["toolbar", "children", "footer"]);
  });
});
