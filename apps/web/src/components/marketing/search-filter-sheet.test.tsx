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

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
  },
}));

vi.mock("@/lib/analytics/events", () => ({
  trackSearch: vi.fn(),
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

    expect(screen.getAllByRole("button", { name: /Filters/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Filters/i })[0]!);

    expect(screen.getByLabelText("Keywords")).toHaveValue("picasso");
    expect(screen.getAllByRole("button", { name: "Show 5 results" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Sort by")).toBeInTheDocument();
  });
});
