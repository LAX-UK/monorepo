import {
  lotCardTimingToTimerInputs,
  toLotTimerInputs,
  toLotTimerInputsFromLot,
} from "@/lib/lot/to-lot-timer-inputs";
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

    expect(
      toLotTimerInputs({
        status: "draft",
        startTime: null,
        endTime: null,
      }),
    ).toEqual({
      status: "draft",
      startTime: null,
      endTime: null,
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

describe("toLotTimerInputsFromLot", () => {
  it("maps lot timing fields to timer inputs", () => {
    expect(
      toLotTimerInputsFromLot({
        status: "active",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: null,
      }),
    ).toEqual({
      status: "active",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: null,
    });
  });
});

describe("lotCardTimingToTimerInputs", () => {
  it("passes through already-normalized timing VMs", () => {
    const timing = {
      status: "active" as const,
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
    };
    expect(lotCardTimingToTimerInputs(timing)).toEqual(timing);
  });
});
