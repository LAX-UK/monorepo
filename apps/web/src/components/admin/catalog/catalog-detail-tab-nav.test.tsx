import { CatalogDetailTabNav } from "@/components/admin/catalog/catalog-detail-tab-nav";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/sales/sale-1/overview",
}));

describe("CatalogDetailTabNav", () => {
  it("renders active sale tab with Figma blue treatment", () => {
    render(
      <CatalogDetailTabNav
        entityKind="sale"
        aria-label="Sale sections"
        tabs={[
          { id: "overview", label: "Overview", href: "/admin/sales/sale-1/overview", count: 4 },
          { id: "lots", label: "Lots", href: "/admin/sales/sale-1/lots", count: 12 },
        ]}
      />,
    );

    const overview = screen.getByRole("link", { name: /overview/i });
    expect(overview.className).toContain("border-secondary");
    expect(overview.className).toContain("text-secondary");
    expect(overview.className).toContain("text-base");
    expect(overview.querySelector("span")?.className).toContain("bg-secondary");
  });
});
