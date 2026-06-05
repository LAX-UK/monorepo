import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MARKETING_CATALOG_PT } from "@/lib/marketing/chrome";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarketingDetailShell", () => {
  it("renders main landmark with catalogue top padding by default", () => {
    const { container } = render(
      <MarketingDetailShell>
        <p>Detail body</p>
      </MarketingDetailShell>,
    );

    const main = container.querySelector("#main-content");
    expect(main).not.toBeNull();
    expect(main?.className).toContain(MARKETING_CATALOG_PT);
    expect(main?.className).toMatch(/bg-page-bg/);
  });

  it("omits catalogue top padding when useCatalogPt is false", () => {
    const { container } = render(
      <MarketingDetailShell useCatalogPt={false} className="pt-[calc(var(--header-height)+8px)]">
        <p>Lot detail</p>
      </MarketingDetailShell>,
    );

    const main = container.querySelector("#main-content");
    expect(main?.className).not.toContain(MARKETING_CATALOG_PT);
    expect(main?.className).toMatch(/pt-\[calc\(var\(--header-height\)\+8px\)\]/);
  });

  it("renders slots in order and applies wayfindingClassName", () => {
    const { container } = render(
      <MarketingDetailShell
        jsonLd={<span data-testid="json-ld">ld</span>}
        leadingChrome={<div data-testid="leading">Leading</div>}
        wayfinding={<nav data-testid="wayfinding">Wayfinding</nav>}
        wayfindingClassName="hidden md:block"
        hero={<header data-testid="hero">Hero</header>}
        stickyChrome={<div data-testid="sticky">Sticky</div>}
      >
        <section data-testid="children">Children</section>
      </MarketingDetailShell>,
    );

    const main = container.querySelector("#main-content");
    const topLevelTags = Array.from(main?.children ?? []).map(
      (el) => el.getAttribute("data-testid") ?? el.tagName.toLowerCase(),
    );
    expect(topLevelTags).toEqual(["json-ld", "leading", "div", "hero", "div", "sticky"]);

    const wayfindingWrapper = main?.children[2] as HTMLElement | undefined;
    expect(wayfindingWrapper?.className).toMatch(/hidden md:block/);
    expect(wayfindingWrapper?.querySelector("[data-testid='wayfinding']")).not.toBeNull();
  });

  it("renders children without inner shell when wrapChildren is false", () => {
    const { container } = render(
      <MarketingDetailShell wrapChildren={false}>
        <section data-testid="bare-children">Bare</section>
      </MarketingDetailShell>,
    );

    const main = container.querySelector("#main-content");
    expect(main?.querySelector("[data-testid='bare-children']")?.parentElement).toBe(main);
  });
});
