import { LazySaleroomCatalogSort } from "@/components/sections/saleroom/saleroom-catalog-sort.lazy";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sales/foo/123",
  useSearchParams: () => new URLSearchParams("sort=priceDesc"),
}));

// The tests share the module cache and run in order: first visit, then a later client navigation.
describe("LazySaleroomCatalogSort", () => {
  it("shows the choice as text, then the select once it arrives", async () => {
    render(<LazySaleroomCatalogSort sortLabel="Price: high to low" />);
    expect(screen.getByLabelText("Sort: Price: high to low")).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Sort lots" })).toBeInTheDocument();
  });

  it("draws the select on its first render once it has arrived (client navigation)", () => {
    render(<LazySaleroomCatalogSort sortLabel="Price: high to low" />);
    expect(screen.getByRole("combobox", { name: "Sort lots" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Sort: Price: high to low")).not.toBeInTheDocument();
  });
});
