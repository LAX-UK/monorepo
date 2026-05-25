import { SearchCatalogPendingProvider } from "@/components/marketing/search-catalog-client";
import { SearchFilterSheet } from "@/components/marketing/search-filter-sheet";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function clickFirstButton(name: string | RegExp) {
  const button = screen.getAllByRole("button", { name })[0];
  if (!button) throw new Error(`Expected button: ${String(name)}`);
  fireEvent.click(button);
}

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
    clickFirstButton(/Filters/i);

    expect(screen.getByLabelText("Keywords")).toHaveValue("picasso");
    expect(screen.getAllByRole("button", { name: "Show 5 results" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Sort by")).toBeInTheDocument();
  });
});
