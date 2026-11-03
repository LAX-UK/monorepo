import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingCountdownPanel } from "./marketing-countdown-panel";

const NOW = new Date("2026-11-01T12:00:00Z");
const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function renderClosing(offsetMs: number) {
  return render(
    <MarketingCountdownPanel
      label="Closes in"
      showLiveDot
      endIso={new Date(NOW.getTime() + offsetMs).toISOString()}
    />,
  );
}

describe("MarketingCountdownPanel beyond a week", () => {
  it("tells the date, not tiles, a moment past seven days", () => {
    renderClosing(7 * DAY + 1000);
    expect(screen.getByText("Sun 8 Nov, 12:00 GMT")).toBeTruthy();
    expect(screen.queryByText("Days")).toBeNull();
  });

  it("shows tiles from exactly seven days down", () => {
    renderClosing(7 * DAY);
    expect(screen.getByText("Days")).toBeTruthy();
    expect(screen.queryByText("Sec")).toBeNull();
    expect(screen.queryByText(/GMT/)).toBeNull();
  });
});

describe("MarketingCountdownPanel seconds", () => {
  it("shows no seconds tile two days out", () => {
    renderClosing(2 * DAY + 5 * 3_600_000);
    expect(screen.getByText("Hours")).toBeTruthy();
    expect(screen.queryByText("Sec")).toBeNull();
    expect(screen.queryByText("Min")).toBeNull();
  });

  it("shows seconds in the final hour", () => {
    renderClosing(42 * 60_000);
    expect(screen.getByText("Min")).toBeTruthy();
    expect(screen.getByText("Sec")).toBeTruthy();
  });
});
