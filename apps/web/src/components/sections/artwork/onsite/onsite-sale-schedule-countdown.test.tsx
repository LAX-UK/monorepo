import type { Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnsiteSaleScheduleCountdown } from "./onsite-sale-schedule-countdown";

const NOW = new Date("2026-11-01T12:00:00Z");
const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function saleStartingIn(offsetMs: number): Sale {
  return {
    id: "s1",
    status: "scheduled",
    deliveryMode: "onsite",
    startTime: new Date(NOW.getTime() + offsetMs).toISOString(),
    endTime: new Date(NOW.getTime() + offsetMs + 3 * 3_600_000).toISOString(),
  } as unknown as Sale;
}

describe("OnsiteSaleScheduleCountdown beyond a week", () => {
  it("tells the date, not tiles, a moment past seven days", () => {
    render(<OnsiteSaleScheduleCountdown sale={saleStartingIn(7 * DAY + 1000)} />);
    expect(screen.getByText("Live event starts")).toBeTruthy();
    expect(screen.getByText("Sun 8 Nov, 12:00 GMT")).toBeTruthy();
    expect(screen.queryByText("Days")).toBeNull();
  });

  it("shows tiles from exactly seven days down", () => {
    render(<OnsiteSaleScheduleCountdown sale={saleStartingIn(7 * DAY)} />);
    expect(screen.getByText("Days")).toBeTruthy();
  });
});
