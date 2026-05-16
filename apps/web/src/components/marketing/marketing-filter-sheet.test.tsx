import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-is-md", () => ({
  useIsMd: () => false,
}));

describe("MarketingFilterSheet", () => {
  it("opens from trigger and calls onApply with apply label", () => {
    const onApply = vi.fn();

    render(
      <MarketingFilterSheet
        title="Filters"
        trigger={<button type="button">Open filters</button>}
        applyLabel="Show 12 results"
        onApply={onApply}
      >
        <p>Filter body</p>
      </MarketingFilterSheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));
    expect(screen.getByText("Filter body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 12 results" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 12 results" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
