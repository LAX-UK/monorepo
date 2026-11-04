import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveFilterChips } from "./toolbar.js";

describe("ActiveFilterChips", () => {
  it("removes a filter that is removable", () => {
    const onRemove = vi.fn();
    render(<ActiveFilterChips filters={[{ id: "q", label: "Search: golden", onRemove }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Search: golden" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("shows a locked filter with no remove button, and says access sets it", () => {
    render(
      <ActiveFilterChips
        filters={[{ id: "source", label: "Source: Integrations · Xero", locked: true }]}
      />,
    );
    const chips = screen.getByRole("list", { name: "Applied filters" });
    expect(within(chips).getByText("Source: Integrations · Xero")).toBeInTheDocument();
    expect(within(chips).getByText(/set by your access/)).toBeInTheDocument();
    expect(within(chips).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers Clear all only when more than one filter can be removed", () => {
    const onClearAll = vi.fn();
    const locked = { id: "source", label: "Source: Xero", locked: true as const };
    const removable = (id: string) => ({ id, label: id, onRemove: () => {} });
    const { rerender } = render(
      <ActiveFilterChips filters={[locked, removable("q")]} onClearAll={onClearAll} />,
    );
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
    rerender(
      <ActiveFilterChips
        filters={[locked, removable("q"), removable("d")]}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
