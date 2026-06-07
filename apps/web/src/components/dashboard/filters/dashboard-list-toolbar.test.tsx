import {
  DashboardListToolbar,
  DashboardSortSelect,
} from "@/components/dashboard/filters/dashboard-list-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("DashboardListToolbar", () => {
  it("renders a single search landmark", () => {
    render(
      <DashboardListToolbar
        search={<input aria-label="Search lots" />}
        searchLabel="Search watchlist"
      />,
    );
    const landmarks = document.querySelectorAll("search");
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]).toHaveAttribute("aria-label", "Search watchlist");
  });

  it("hides primary filters on mobile when mobileFilterSheet is set", () => {
    const { container } = render(
      <DashboardListToolbar
        primaryFilters={<div data-testid="primary-chips">Chips</div>}
        mobileFilterSheet={<button type="button">Filters</button>}
      />,
    );
    const primaryWrapper = container.querySelector("[data-testid='primary-chips']")?.parentElement;
    expect(primaryWrapper?.className).toContain("hidden");
    expect(primaryWrapper?.className).toContain("lg:block");
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("hides sort on mobile when hideSortOnMobile is set", () => {
    render(
      <DashboardListToolbar
        hideSortOnMobile
        sort={
          <DashboardSortSelect
            label="Sort"
            value="date-desc"
            options={[{ value: "date-desc", label: "Newest" }]}
            onValueChange={() => {}}
          />
        }
        mobileFilterSheet={<button type="button">Filters</button>}
      />,
    );

    const sortTriggers = screen.getAllByRole("combobox", { name: "Sort" });
    expect(sortTriggers).toHaveLength(1);
    expect(sortTriggers[0]?.closest(".lg\\:block")).toBeTruthy();
  });

  it("renders compact mobile row with search, filters trigger, and inline sort", () => {
    render(
      <DashboardListToolbar
        search={<input aria-label="Search" />}
        mobileFilterSheet={<button type="button">Filters</button>}
        sort={
          <DashboardSortSelect
            label="Sort"
            value="a"
            options={[{ value: "a", label: "A" }]}
            onValueChange={() => {}}
          />
        }
      />,
    );

    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: "Sort" })).toHaveLength(1);
  });

  it("keeps search and filter trigger on one row when only drawer filters are used", () => {
    const { container } = render(
      <DashboardListToolbar
        search={<input aria-label="Search submissions" />}
        mobileFilterSheet={<button type="button">Filters</button>}
        filterSheet={<button type="button">Filters desktop</button>}
      />,
    );

    const row = container.querySelector("search")?.parentElement;
    expect(row?.className).toContain("flex-nowrap");
    expect(row?.className).toContain("items-end");
    expect(container.querySelector("search")?.className).toContain("max-w-md");
  });

  it("renders mobile overflow trigger when actions are provided", () => {
    render(
      <DashboardListToolbar
        search={<input aria-label="Search" />}
        actions={<button type="button">Export</button>}
        actionsOverflowLabel="List actions"
      />,
    );

    const overflowTrigger = screen.getByRole("button", { name: "List actions" });
    expect(overflowTrigger.closest(".lg\\:hidden")).toBeTruthy();
  });
});

describe("DashboardSortSelect", () => {
  it("supports compactOnMobile label hiding", () => {
    render(
      <DashboardSortSelect
        label="Sort"
        value="a"
        options={[{ value: "a", label: "A" }]}
        onValueChange={vi.fn()}
        compactOnMobile
      />,
    );

    const label = screen.getByText("Sort");
    expect(label.className).toContain("max-lg:sr-only");
  });
});
