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
        timer={{ words: "1 hour", compact: "1h 0m", date: null }}
        variant="endingSoon"
        layout="overlay"
      />,
    );
    const frame = container.querySelector("output")?.parentElement;
    expect(frame?.className).toMatch(/\babsolute\b/);
    expect(frame?.className).toMatch(/@container/);
  });

  it("omits absolute positioning for inline layout", () => {
    const { container } = render(
      <LotTimerPill
        state={{ kind: "live", msLeft: 60_000 }}
        timer={{ words: "1 hour", compact: "1h 0m", date: null }}
        variant="endingSoon"
        layout="inline"
      />,
    );
    const pill = container.querySelector("output");
    expect(pill?.className).not.toMatch(/\babsolute\b/);
    expect(pill?.className).toMatch(/inline-flex/);
  });
});

describe("LotTimerPill value", () => {
  const live = { kind: "live" as const, msLeft: 42 * 60_000 + 9_000 };

  it("keeps the chip one fixed-height line and offers words and a clock", () => {
    const { container } = render(
      <LotTimerPill
        state={live}
        timer={{ words: "42 minutes 9 seconds", compact: "42:09", date: null }}
        variant="endingSoon"
      />,
    );
    const pill = container.querySelector("output");
    expect(pill?.className).toMatch(/\bh-8\b/);
    expect(pill?.className).not.toMatch(/min-h-8/);
    expect(pill?.className).toMatch(/whitespace-nowrap/);
    expect(pill?.textContent).toContain("42 minutes 9 seconds");
    expect(pill?.textContent).toContain("42:09");
    expect(container.querySelectorAll("span span.tabular-nums")).toHaveLength(2);
  });

  it("shows only the words in flow, where there is room", () => {
    const { container } = render(
      <LotTimerPill
        state={live}
        timer={{ words: "42 minutes 9 seconds", compact: "42:09", date: null }}
        layout="inline"
      />,
    );
    expect(container.querySelector("output")?.textContent).toBe("Live · 42 minutes 9 seconds");
  });

  it("speaks the words, whichever form shows", () => {
    const { container } = render(
      <LotTimerPill
        state={live}
        timer={{ words: "42 minutes 9 seconds", compact: "42:09", date: null }}
      />,
    );
    expect(container.querySelector("output")?.getAttribute("aria-label")).toBe(
      "Live auction. Ends in 42 minutes 9 seconds.",
    );
  });

  it("tells a date beyond a week, in one form", () => {
    const { container } = render(
      <LotTimerPill
        state={{ kind: "opensSoon", msLeft: 9 * 86_400_000 }}
        timer={{ words: "", compact: "Thu 12 Nov", date: "Thu 12 Nov" }}
      />,
    );
    const pill = container.querySelector("output");
    expect(pill?.textContent).toBe("Opens Thu 12 Nov");
    expect(pill?.getAttribute("aria-label")).toBe("Opens Thu 12 Nov.");
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
