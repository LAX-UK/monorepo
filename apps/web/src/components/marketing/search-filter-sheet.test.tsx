import { SearchCatalogPendingProvider } from "@/components/marketing/search-catalog-client";
import { SearchFilterSheet } from "@/components/marketing/search-filter-sheet";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/search",
  useSearchParams: () => new URLSearchParams("sort=createdDesc"),
}));

vi.mock("@/hooks/use-is-md", () => ({
  useIsMd: () => false,
}));

describe("SearchFilterSheet", () => {
  it("opens sheet with keywords field, sort group, and result apply label", () => {
    render(
      <SearchCatalogPendingProvider>
        <SearchFilterSheet
          activeCount={2}
          initialQ="picasso"
          sort="createdDesc"
          view="grid"
          categories={[]}
          trimmed="picasso"
          resultCountLabel="Show 5 results"
        />
      </SearchCatalogPendingProvider>,
    );

    expect(screen.getByRole("button", { name: /Filters/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Filters/i }));

    expect(screen.getByLabelText("Keywords")).toHaveValue("picasso");
    expect(screen.getByRole("button", { name: "Show 5 results" })).toBeInTheDocument();
    expect(screen.getByText("Sort by")).toBeInTheDocument();
  });
});
