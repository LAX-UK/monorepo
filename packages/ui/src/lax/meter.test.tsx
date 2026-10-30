import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Meter } from "./index.js";

describe("Meter", () => {
  it("is a meter named with its figures, clamped to 0–100", () => {
    render(<Meter value={132} label="£33,000 of £25,000 used" />);
    const meter = screen.getByRole("meter", { name: "£33,000 of £25,000 used" });
    expect(meter).toHaveAttribute("aria-valuenow", "100");
  });

  it("turns to warning from 80% and danger when full", () => {
    const { container, rerender } = render(<Meter value={32} label="a" />);
    expect(container.querySelector("[role=meter] > div")?.className).toContain("bg-lax-ink");
    rerender(<Meter value={85} label="a" />);
    expect(container.querySelector("[role=meter] > div")?.className).toContain(
      "bg-lax-warning-dot",
    );
    rerender(<Meter value={100} label="a" />);
    expect(container.querySelector("[role=meter] > div")?.className).toContain(
      "bg-lax-danger-solid",
    );
  });
});
