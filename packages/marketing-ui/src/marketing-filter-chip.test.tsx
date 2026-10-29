import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingFilterChip } from "./marketing-filter-chip.js";

describe("MarketingFilterChip", () => {
  it("names the chip with its label and spoken count", () => {
    render(
      <MarketingFilterChip
        label="Available now"
        count={3}
        countNoun={{ one: "edition", other: "editions" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Available now , 3 editions" })).toBeInTheDocument();
  });

  it("uses the singular noun for one", () => {
    render(<MarketingFilterChip label="Under £50" count={1} />);
    expect(screen.getByRole("button", { name: "Under £50 , 1 work" })).toBeInTheDocument();
  });

  it("reports whether it is applied", () => {
    const { rerender } = render(<MarketingFilterChip label="Under £50" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    rerender(<MarketingFilterChip label="Under £50" active />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("is a plain button that calls its handler", () => {
    const onClick = vi.fn();
    render(<MarketingFilterChip label="Flora Powers" onClick={onClick} />);
    const chip = screen.getByRole("button");
    expect(chip).toHaveAttribute("type", "button");
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
