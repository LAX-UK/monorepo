import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressRing } from "./progress-ring.js";

const arcOffset = (container: HTMLElement) =>
  Number(
    container.querySelector('[data-slot="progress-ring-arc"]')?.getAttribute("stroke-dashoffset"),
  );

describe("ProgressRing", () => {
  it("exposes the step count to assistive technology", () => {
    render(<ProgressRing value={2} max={5} label="Checkup progress" />);
    const ring = screen.getByRole("progressbar", { name: "Checkup progress" });
    expect(ring).toHaveAttribute("aria-valuenow", "2");
    expect(ring).toHaveAttribute("aria-valuemax", "5");
    expect(ring).toHaveAttribute("aria-valuetext", "2 of 5");
  });

  it("draws the arc in proportion to the steps done", () => {
    const { container } = render(
      <ProgressRing value={1} max={4} label="Progress" size={100} strokeWidth={10} />,
    );
    expect(arcOffset(container)).toBeCloseTo(2 * Math.PI * 45 * 0.75);
  });

  it("clamps out-of-range values and tolerates an empty total", () => {
    const { container, rerender } = render(<ProgressRing value={9} max={3} label="Progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    expect(arcOffset(container)).toBeCloseTo(0);

    rerender(<ProgressRing value={1} max={0} label="Progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(arcOffset(container)).toBeGreaterThan(0);
  });

  it("hides the centre content from assistive technology", () => {
    render(
      <ProgressRing value={0} max={3} label="Progress">
        0/3
      </ProgressRing>,
    );
    expect(screen.getByText("0/3")).toHaveAttribute("aria-hidden", "true");
  });
});
