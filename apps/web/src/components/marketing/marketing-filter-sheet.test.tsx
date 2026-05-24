import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

    fireEvent.click(screen.getAllByRole("button", { name: "Open filters" })[0]!);
    expect(screen.getAllByText("Filter body").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Show 12 results" })[0]!);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("exposes a close control and sticky apply footer in the bottom sheet chrome", () => {
    render(
      <MarketingFilterSheet title="Filters" open onOpenChange={() => {}} onApply={() => {}}>
        <p>Filter body</p>
      </MarketingFilterSheet>,
    );

    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Apply" }).length).toBeGreaterThan(0);
  });

  it("calls onOpenChange(false) when the close control is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <MarketingFilterSheet title="Filters" open onOpenChange={onOpenChange}>
        <p>Filter body</p>
      </MarketingFilterSheet>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("routes controlled open to one overlay surface at a time", () => {
    render(
      <MarketingFilterSheet title="Filters" open onOpenChange={() => {}}>
        <p>Filter body</p>
      </MarketingFilterSheet>,
    );

    expect(screen.getAllByText("Filter body")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });
});
