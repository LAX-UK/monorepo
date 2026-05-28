import { SalesCalendarFilterSheet } from "@/components/sections/sales/sales-calendar-filter-sheet";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function clickFirstButton(name: string | RegExp) {
  const button = screen.getAllByRole("button", { name })[0];
  if (!button) throw new Error(`Expected button: ${String(name)}`);
  fireEvent.click(button);
}

const baseState = {
  tab: "upcoming" as const,
  deliveryMode: "online" as const,
  location: "all" as const,
  sort: "startAsc" as const,
  view: "grid" as const,
};

describe("SalesCalendarFilterSheet", () => {
  it("opens from trigger and applies with result label", () => {
    render(
      <SalesCalendarFilterSheet
        state={baseState}
        resultCount={8}
        categories={[]}
        years={[2026]}
        resultCountLabel="Show 8 sales"
      />,
    );

    clickFirstButton(/Filters/i);
    expect(screen.getAllByText("Auction Type").length).toBeGreaterThan(0);
    clickFirstButton("Show 8 sales");
  });

  it("resets facets while preserving tab and view", () => {
    push.mockClear();
    render(
      <SalesCalendarFilterSheet
        state={{ ...baseState, view: "list", categoryId: "cat-1" }}
        resultCount={3}
        categories={[{ id: "cat-1", name: "Modern Art" }]}
        years={[2026]}
        resultCountLabel="Show 3 sales"
      />,
    );

    clickFirstButton(/Filters/i);
    clickFirstButton("Reset");
    expect(push).toHaveBeenCalledWith("/sales?view=list");
  });
});
