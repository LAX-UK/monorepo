import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar.js";

describe("ProgressBar", () => {
  it("names what is counted and says how far along it is", () => {
    render(<ProgressBar value={12} max={40} label="Lots complete" />);
    const bar = screen.getByRole("progressbar", { name: "Lots complete" });
    expect(bar).toHaveAttribute("aria-valuenow", "12");
    expect(bar).toHaveAttribute("aria-valuetext", "12 of 40");
    expect(bar.firstElementChild).toHaveStyle({ width: "30%" });
  });

  it("stays within its track when the value is out of range or the total is zero", () => {
    const { rerender } = render(<ProgressBar value={60} max={40} label="Lots complete" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({ width: "100%" });
    rerender(<ProgressBar value={3} max={0} label="Lots complete" />);
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({ width: "0%" });
  });

  it("is neutral by default and takes the warning or danger fill when asked", () => {
    const { rerender } = render(<ProgressBar value={1} max={4} label="Time used" />);
    const fill = () => screen.getByRole("progressbar").firstElementChild;
    expect(fill()).toHaveAttribute("data-tone", "neutral");
    expect(fill()).toHaveClass("bg-staff-ink");
    rerender(<ProgressBar value={1} max={4} label="Time used" tone="warning" />);
    expect(fill()).toHaveClass("bg-staff-warning-dot");
    rerender(<ProgressBar value={1} max={4} label="Time used" tone="danger" />);
    expect(fill()).toHaveClass("bg-staff-danger-dot");
    expect(fill()).not.toHaveClass("bg-staff-ink");
  });
});
