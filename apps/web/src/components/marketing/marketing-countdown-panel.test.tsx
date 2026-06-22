import { MarketingCountdownPanel } from "@/components/marketing/marketing-countdown-panel";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: vi.fn(() => false),
}));

vi.mock("@/lib/time/use-client-clock", () => ({
  useClientClock: vi.fn(),
}));

import { useClientClock } from "@/lib/time/use-client-clock";

const baseNow = Date.parse("2026-06-01T12:00:00.000Z");

describe("MarketingCountdownPanel", () => {
  beforeEach(() => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    vi.mocked(useClientClock).mockReturnValue(baseNow);
  });

  it("renders label and 3-col segment grid when under 24 hours remain", () => {
    const endIso = new Date(baseNow + 12 * 3_600_000).toISOString();

    render(<MarketingCountdownPanel label="Closes in" endIso={endIso} showLiveDot />);

    expect(screen.getByText("Closes in")).toBeInTheDocument();
    expect(screen.queryByText("Days")).not.toBeInTheDocument();
    expect(screen.getByText("Hours")).toBeInTheDocument();
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("Sec")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows LiveDot when showLiveDot is true", () => {
    const endIso = new Date(baseNow + 5 * 3_600_000).toISOString();
    const { container } = render(
      <MarketingCountdownPanel label="Closes in" endIso={endIso} showLiveDot />,
    );

    expect(container.querySelector(".live-dot-pulse")).toBeTruthy();
  });

  it("applies urgency text color when under one hour remains", () => {
    const endIso = new Date(baseNow + 30 * 60_000).toISOString();
    const { container } = render(
      <MarketingCountdownPanel label="Closes in" endIso={endIso} showLiveDot />,
    );

    expect(container.querySelector(".text-live-red")).toBeTruthy();
  });

  it("renders secondary line when provided", () => {
    const endIso = new Date(baseNow + 5 * 3_600_000).toISOString();

    render(
      <MarketingCountdownPanel
        label="Opens in"
        endIso={endIso}
        secondaryLine="Starts · 2 Jun 2026, 12:00"
      />,
    );

    expect(screen.getByText("Starts · 2 Jun 2026, 12:00")).toBeInTheDocument();
  });

  it("shows static datetime when reduced motion is enabled", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const end = new Date(baseNow + 12 * 3_600_000);
    const endIso = end.toISOString();
    const formatted = end.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

    render(<MarketingCountdownPanel label="Opens in" endIso={endIso} />);

    expect(screen.queryByText("Hours")).not.toBeInTheDocument();
    expect(screen.getByText(formatted)).toBeInTheDocument();
  });
});
