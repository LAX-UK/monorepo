import { DashboardFilterSheet } from "@/components/dashboard/filters/dashboard-filter-sheet";
import { SplitFilterSheet } from "@/components/ui/split-filter-sheet";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function clickFirstButton(name: string | RegExp) {
  const button = screen.getAllByRole("button", { name })[0];
  if (!button) throw new Error(`Expected button: ${String(name)}`);
  fireEvent.click(button);
}

describe("DashboardFilterSheet", () => {
  it("calls onApply from footer", () => {
    const onApply = vi.fn();
    render(
      <DashboardFilterSheet title="Filters" open onOpenChange={() => {}} onApply={onApply}>
        <p>Filter body</p>
      </DashboardFilterSheet>,
    );
    clickFirstButton("Apply");
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

describe("SplitFilterSheet", () => {
  it("opens from trigger", () => {
    render(
      <SplitFilterSheet
        title="Filters"
        trigger={<button type="button">Open filters</button>}
        onApply={() => {}}
      >
        <p>Filter body</p>
      </SplitFilterSheet>,
    );
    clickFirstButton("Open filters");
    expect(screen.getAllByText("Filter body").length).toBeGreaterThan(0);
  });
});
