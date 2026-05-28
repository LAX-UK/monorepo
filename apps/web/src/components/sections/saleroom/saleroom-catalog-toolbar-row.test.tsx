import { SaleroomCatalogToolbarRow } from "@/components/sections/saleroom/saleroom-catalog-toolbar-row";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sales/foo/123",
  useSearchParams: () => searchParams,
}));

const baseProps = {
  basePath: "/sales/foo/123",
  layoutView: "grid" as const,
  countLabel: "24 lots",
  resultCountLabel: "Show 24 lots",
  totalLots: 24,
};

describe("SaleroomCatalogToolbarRow", () => {
  it("renders mobile filter trigger and view switcher on one toolbar row", () => {
    searchParams = new URLSearchParams();

    render(<SaleroomCatalogToolbarRow {...baseProps} />);

    expect(screen.getAllByRole("button", { name: /Filters/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-trailing-row")).not.toBeInTheDocument();

    const allLink = screen.getByRole("link", { name: "All" });
    expect(allLink.closest(".hidden.md\\:flex")).toBeTruthy();
  });

  it("shows filter badge and active status chip when status is set", () => {
    searchParams = new URLSearchParams("status=live");

    render(<SaleroomCatalogToolbarRow {...baseProps} />);

    expect(
      screen.getAllByRole("button", { name: /Filters.*1 active filters/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
    const activeFilters = screen.getByLabelText("Active filters");
    expect(activeFilters).toHaveTextContent("Live");
    expect(activeFilters.querySelector('a[href="/sales/foo/123"]')).toBeTruthy();
  });

  it("does not render active filters when status is all", () => {
    searchParams = new URLSearchParams();

    render(<SaleroomCatalogToolbarRow {...baseProps} />);

    expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();
  });
});
