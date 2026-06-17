import { MarketingCatalogGrid } from "@/components/marketing/marketing-catalog-grid";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarketingCatalogGrid", () => {
  it("applies equal-height grid classes for multi-item layouts", () => {
    const { container } = render(
      <MarketingCatalogGrid count={3} multi="grid grid-cols-1 lg:grid-cols-3" gridClassName="gap-6">
        <div key="a">A</div>
        <div key="b">B</div>
        <div key="c">C</div>
      </MarketingCatalogGrid>,
    );

    const grid = container.querySelector("ul");
    expect(grid?.className).toMatch(/auto-rows-fr/);
    expect(grid?.className).toMatch(/items-stretch/);
    expect(grid?.className).toMatch(/lg:grid-cols-3/);

    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.className).toMatch(/h-full/);
    }
  });

  it("centers a single item with sparse grid classes", () => {
    const { container } = render(
      <MarketingCatalogGrid count={1} multi="grid grid-cols-1 lg:grid-cols-3">
        <div key="only">Only</div>
      </MarketingCatalogGrid>,
    );

    const grid = container.querySelector("ul");
    expect(grid?.className).toMatch(/max-w-md/);
    expect(grid?.className).toMatch(/justify-items-center/);
  });
});
