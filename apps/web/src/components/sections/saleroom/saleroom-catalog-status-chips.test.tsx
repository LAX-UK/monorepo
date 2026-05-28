import { SaleroomCatalogStatusChips } from "@/components/sections/saleroom/saleroom-catalog-status-chips";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

describe("SaleroomCatalogStatusChips", () => {
  it("renders strip layout with all status links", () => {
    searchParams = new URLSearchParams();

    render(<SaleroomCatalogStatusChips basePath="/sales/foo/123" layout="strip" />);

    expect(screen.getByLabelText("Lot status")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/sales/foo/123");
    expect(screen.getByRole("link", { name: "Live" })).toHaveAttribute(
      "href",
      "/sales/foo/123?status=live",
    );
  });

  it("marks active status in list layout", () => {
    searchParams = new URLSearchParams("status=upcoming&view=list");

    render(<SaleroomCatalogStatusChips basePath="/sales/foo/123" layout="list" />);

    expect(screen.getByLabelText("Lot status")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upcoming" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Upcoming" })).toHaveAttribute(
      "href",
      "/sales/foo/123?status=upcoming&view=list",
    );
  });
});
