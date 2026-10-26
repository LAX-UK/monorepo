import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MappedStatusBadge, StatusBadge, defineStatusMap, humanizeStatus } from "./status-badge.js";

const present = defineStatusMap({
  paid: { label: "Paid", tone: "success" },
  live: { label: "Live", tone: "live", live: true },
});

describe("defineStatusMap", () => {
  it("maps known statuses to their label and tone", () => {
    expect(present("paid")).toEqual({ label: "Paid", tone: "success" });
  });

  it("renders an unknown status by name in the neutral tone instead of failing", () => {
    expect(present("partially_refunded")).toEqual({ label: "Partially refunded", tone: "neutral" });
  });
});

describe("humanizeStatus", () => {
  it("reads machine names as sentence case", () => {
    expect(humanizeStatus("ready_for-collection")).toBe("Ready for collection");
  });
});

describe("StatusBadge", () => {
  it("draws live as its own solid tone with a pulsing white dot, never the danger tint", () => {
    const { container } = render(
      <StatusBadge tone="live" live>
        Live
      </StatusBadge>,
    );
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("bg-staff-live-bg");
    expect(badge.className).not.toContain("bg-staff-danger-bg");
    const dot = badge.firstElementChild as HTMLElement;
    expect(dot.className).toContain("animate-pulse");
    expect(dot.className).toContain("bg-staff-on-live");
  });

  it("pulses the live red dot on a tinted tone", () => {
    const { container } = render(
      <StatusBadge tone="info" live>
        Opening
      </StatusBadge>,
    );
    const dot = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(dot.className).toContain("bg-staff-live-dot");
  });
});

describe("MappedStatusBadge", () => {
  it("names the state in text, never by colour alone", () => {
    render(<MappedStatusBadge status="paid" present={present} />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });
});
