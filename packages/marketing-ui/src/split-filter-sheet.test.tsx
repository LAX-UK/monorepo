import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SplitFilterSheet } from "./split-filter-sheet.js";

// The test setup reports `lg` (1024px) as matching, so the desktop drawer renders.
describe("SplitFilterSheet", () => {
  it("keeps the default drawer's Reset + Apply footer", () => {
    const onReset = vi.fn();
    render(
      <SplitFilterSheet open onOpenChange={() => {}} onApply={() => {}} onReset={onReset}>
        <p>Facets</p>
      </SplitFilterSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(dialog.className).toContain("max-w-sm");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("renders the catalogue drawer at 600px with Cancel and Apply", () => {
    const onApply = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <SplitFilterSheet
        variant="catalogue"
        open
        onOpenChange={onOpenChange}
        onApply={onApply}
        onReset={() => {}}
        resetLabel="Reset all"
      >
        <p>Facets</p>
      </SplitFilterSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(dialog.className).toContain("lg:w-[37.5rem]");
    expect(screen.queryByRole("button", { name: "Reset all" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
