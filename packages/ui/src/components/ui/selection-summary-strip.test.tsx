import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectionSummaryStrip } from "./selection-summary-strip.js";

describe("SelectionSummaryStrip", () => {
  it("renders summary content", () => {
    render(
      <SelectionSummaryStrip>
        Joining as <strong>Individual</strong>
      </SelectionSummaryStrip>,
    );
    expect(screen.getByText(/joining as/i)).toBeInTheDocument();
  });

  it("calls onChange when change is clicked", () => {
    const onChange = vi.fn();
    render(
      <SelectionSummaryStrip onChange={onChange}>Joining as Individual</SelectionSummaryStrip>,
    );
    fireEvent.click(screen.getByRole("button", { name: /change/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
