import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LotCardTimer } from "./lot-card-timer";
import { LotTimerPill } from "./lot-timer-pill";

vi.mock("@/hooks/use-now", () => ({
  useNow: () => Date.parse("2026-01-01T12:00:00.000Z"),
}));

describe("LotTimerPill layout", () => {
  it("uses absolute positioning for overlay layout", () => {
    const { container } = render(
      <LotTimerPill
        state={{ kind: "live", msLeft: 60_000 }}
        clockText="1h"
        variant="endingSoon"
        layout="overlay"
      />,
    );
    const pill = container.querySelector("output");
    expect(pill?.className).toMatch(/\babsolute\b/);
  });

  it("omits absolute positioning for inline layout", () => {
    const { container } = render(
      <LotTimerPill
        state={{ kind: "live", msLeft: 60_000 }}
        clockText="1h"
        variant="endingSoon"
        layout="inline"
      />,
    );
    const pill = container.querySelector("output");
    expect(pill?.className).not.toMatch(/\babsolute\b/);
    expect(pill?.className).toMatch(/inline-flex/);
  });
});

describe("LotCardTimer layout", () => {
  it("passes inline layout to the pill", () => {
    const { container } = render(
      <LotCardTimer
        layout="inline"
        variant="endingSoon"
        status="active"
        startTime="2026-01-01T00:00:00.000Z"
        endTime="2026-01-02T00:00:00.000Z"
      />,
    );
    const pill = container.querySelector("output");
    expect(pill?.className).not.toMatch(/\babsolute\b/);
  });
});
