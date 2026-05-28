import { toLotTimerInputs } from "@/lib/lot/to-lot-timer-inputs";
import { describe, expect, it } from "vitest";

describe("toLotTimerInputs", () => {
  it("passes through ISO strings and null", () => {
    expect(
      toLotTimerInputs({
        status: "active",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual({
      status: "active",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
    });
  });

  it("converts Date values to ISO strings", () => {
    const startTime = new Date("2026-01-01T00:00:00.000Z");
    const endTime = new Date("2026-01-02T00:00:00.000Z");

    expect(
      toLotTimerInputs({
        status: "scheduled",
        startTime,
        endTime,
      }),
    ).toEqual({
      status: "scheduled",
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });
  });
});
