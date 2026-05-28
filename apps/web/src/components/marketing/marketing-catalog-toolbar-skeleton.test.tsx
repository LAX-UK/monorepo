import { MarketingCatalogToolbarSkeleton } from "@/components/marketing/marketing-catalog-toolbar-skeleton";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarketingCatalogToolbarSkeleton", () => {
  it("renders a single-row toolbar without mobile trailing row", () => {
    const { container } = render(<MarketingCatalogToolbarSkeleton />);
    expect(container.querySelector('[data-testid="mobile-trailing-row"]')).toBeNull();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(2);
  });

  it("renders active chip placeholders when requested", () => {
    const { container } = render(<MarketingCatalogToolbarSkeleton showActiveChips />);
    expect(container.querySelectorAll(".rounded-full").length).toBeGreaterThan(2);
  });
});
