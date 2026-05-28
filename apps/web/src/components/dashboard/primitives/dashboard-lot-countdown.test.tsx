import { DashboardLotCountdown } from "@/components/dashboard/primitives/dashboard-lot-countdown";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-now", () => ({
  useNow: () => Date.parse("2026-01-01T12:00:00.000Z"),
}));

const liveLot = {
  status: "active" as const,
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2026-01-02T00:00:00.000Z",
};

describe("DashboardLotCountdown", () => {
  it("renders multiple inline countdown badges without absolute positioning", () => {
    const { container } = render(
      <ul>
        {[1, 2, 3].map((n) => (
          <li key={n}>
            <DashboardLotCountdown {...liveLot} />
          </li>
        ))}
      </ul>,
    );

    expect(screen.getAllByText("Live")).toHaveLength(3);

    for (const span of container.querySelectorAll("span")) {
      expect(span.className).not.toMatch(/\babsolute\b/);
    }
  });

  it("accepts Date timing fields", () => {
    render(
      <DashboardLotCountdown
        status="active"
        startTime={new Date("2026-01-01T00:00:00.000Z")}
        endTime={new Date("2026-01-02T00:00:00.000Z")}
      />,
    );

    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
