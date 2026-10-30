import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { DateRangeFilter } from "./date-range-filter.js";
import { daysBefore, londonToday } from "./date-ranges.js";

// Radix popovers keep positioning loops running in jsdom; this stand-in keeps the open contract.
vi.mock("@auction/ui/components/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("day helpers", () => {
  it("counts back across month and year ends", () => {
    expect(daysBefore("2026-03-02", 6)).toBe("2026-02-24");
    expect(daysBefore("2026-01-03", 5)).toBe("2025-12-29");
  });

  it("reads the London day, not the UTC day, in summer", () => {
    expect(londonToday(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(londonToday(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-01");
  });
});

describe("DateRangeFilter", () => {
  const today = "2026-10-24";

  it("applies a preset as whole days ending today", () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        label="Date"
        value={{ from: "", to: "" }}
        onChange={onChange}
        today={today}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));

    expect(onChange).toHaveBeenCalledWith({ from: "2026-10-18", to: "2026-10-24" });
  });

  it("marks the preset that matches the current range", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={{ from: "2026-10-24", to: "2026-10-24" }}
        onChange={vi.fn()}
        today={today}
      />,
    );

    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("swaps a range chosen the wrong way round", () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        label="Date"
        value={{ from: "2026-10-10", to: "" }}
        onChange={onChange}
        today={today}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: "2026-10-01" } });

    expect(onChange).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-10" });
  });

  it("offers to clear a range that is set, and only then", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DateRangeFilter
        label="Date"
        value={{ from: "", to: "" }}
        onChange={onChange}
        today={today}
      />,
    );
    expect(screen.queryByRole("button", { name: "Clear dates" })).toBeNull();

    rerender(
      <DateRangeFilter
        label="Date"
        value={{ from: "2026-10-01", to: "" }}
        onChange={onChange}
        today={today}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear dates" }));

    expect(onChange).toHaveBeenCalledWith({ from: "", to: "" });
  });
});
