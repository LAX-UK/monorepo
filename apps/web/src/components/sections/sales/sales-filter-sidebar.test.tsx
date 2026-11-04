import { SalesFilterSidebar } from "@/components/sections/sales/sales-filter-sidebar";
import type { SalesFacetCounts } from "@/lib/marketing/sales-calendar-facets";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const state = {
  tab: "upcoming" as const,
  deliveryMode: "online" as const,
  location: "all" as const,
  sort: "startAsc" as const,
  view: "grid" as const,
};

const facets: SalesFacetCounts = {
  delivery: { online: 4, onsite: 0 },
  location: { online: 3, london: 2 },
  months: { 11: 3 },
  years: { 2026: 4 },
  departments: { "cat-1": 2 },
};

function renderRail() {
  render(
    <SalesFilterSidebar
      state={state}
      resultCount={4}
      categories={[
        { id: "cat-1", name: "Modern Art" },
        { id: "cat-2", name: "Ceramics" },
      ]}
      years={[2026]}
      facets={facets}
      showResultCount={false}
    />,
  );
}

describe("SalesFilterSidebar", () => {
  beforeEach(() => push.mockClear());

  it("reads each option with its count, and the applied one is checked", () => {
    renderRail();
    expect(screen.getByRole("checkbox", { name: "Online , 4" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "London , 2" })).not.toBeChecked();
  });

  it("disables an option that would give no sales", () => {
    renderRail();
    expect(screen.getByRole("checkbox", { name: "In-person , 0" })).toBeDisabled();
  });

  it("takes an applied option off by going to the address without it", () => {
    renderRail();
    fireEvent.click(screen.getByRole("checkbox", { name: "Online , 4" }));
    expect(push).toHaveBeenCalledWith("/sales?tab=upcoming", { scroll: false });
  });

  it("shows no counts when they could not be made", () => {
    render(
      <SalesFilterSidebar
        state={state}
        resultCount={4}
        categories={[]}
        years={[2026]}
        facets={null}
        showResultCount={false}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "In-person" })).toBeEnabled();
  });
});
