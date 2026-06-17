import { MarketingCatalogToolbarSkeleton } from "@/components/marketing/marketing-catalog-toolbar-skeleton";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarketingCatalogToolbarSkeleton", () => {
  it("aligns desktop filter placeholders with lg toolbar split", () => {
    const { container } = render(<MarketingCatalogToolbarSkeleton />);

    const filterSlot = container.querySelector(".hidden.min-w-0.flex-1.gap-2");
    expect(filterSlot?.className).toMatch(/lg:flex/);
    expect(filterSlot?.className).not.toMatch(/md:flex/);

    const sheetTrigger = container.querySelector(".shrink-0.lg\\:hidden");
    expect(sheetTrigger).not.toBeNull();
  });

  it("can render a mobile trailing row placeholder", () => {
    const { container } = render(<MarketingCatalogToolbarSkeleton showMobileTrailing />);

    expect(container.querySelector(".lg\\:hidden.pt-1")).not.toBeNull();
  });
});
