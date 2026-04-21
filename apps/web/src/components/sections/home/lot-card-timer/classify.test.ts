import { describe, expect, it } from "vitest";
import { classifyLotTimerState } from "./classify";

/** Fixed instant for deterministic tests */
const T0 = Date.parse("2025-06-01T12:00:00.000Z");

describe("classifyLotTimerState", () => {
  it("returns cancelled regardless of now", () => {
    expect(
      classifyLotTimerState(
        { status: "cancelled", startTime: "2025-06-01T10:00:00.000Z", endTime: "2025-06-05T12:00:00.000Z" },
        T0,
      ),
    ).toEqual({ kind: "cancelled" });
    expect(classifyLotTimerState({ status: "cancelled", startTime: null, endTime: null }, null)).toEqual({
      kind: "cancelled",
    });
  });

  it("when now is null, ended becomes closed; otherwise unknown", () => {
    expect(
      classifyLotTimerState(
        { status: "ended", startTime: "2025-06-01T10:00:00.000Z", endTime: "2025-06-01T13:00:00.000Z" },
        null,
      ),
    ).toEqual({ kind: "closed" });
    expect(classifyLotTimerState({ status: "active", startTime: null, endTime: null }, null)).toEqual({
      kind: "unknown",
    });
  });

  it("closed when end is in the past or status is ended", () => {
    expect(
      classifyLotTimerState(
        { status: "active", startTime: "2025-06-01T10:00:00.000Z", endTime: "2025-06-01T11:00:00.000Z" },
        T0,
      ),
    ).toEqual({ kind: "closed" });
    expect(
      classifyLotTimerState(
        { status: "ended", startTime: "2025-05-01T10:00:00.000Z", endTime: "2025-06-02T13:00:00.000Z" },
        T0,
      ),
    ).toEqual({ kind: "closed" });
  });

  it("opensSoon when start is strictly after now", () => {
    expect(
      classifyLotTimerState(
        { status: "scheduled", startTime: "2025-06-01T14:00:00.000Z", endTime: "2025-06-03T12:00:00.000Z" },
        T0,
      ),
    ).toEqual({ kind: "opensSoon", msLeft: 2 * 60 * 60 * 1000 });
  });

  it("live when active, end in future, and start is absent or not after now", () => {
    expect(
      classifyLotTimerState(
        { status: "active", startTime: "2025-06-01T10:00:00.000Z", endTime: "2025-06-01T15:00:00.000Z" },
        T0,
      ),
    ).toEqual({ kind: "live", msLeft: 3 * 60 * 60 * 1000 });
    expect(
      classifyLotTimerState(
        { status: "active", startTime: null, endTime: "2025-06-01T15:00:00.000Z" },
        T0,
      ),
    ).toEqual({ kind: "live", msLeft: 3 * 60 * 60 * 1000 });
  });

  it("unknown for non-active lots that do not match opensSoon", () => {
    expect(
      classifyLotTimerState(
        { status: "draft", startTime: "2025-06-01T10:00:00.000Z", endTime: "2025-06-05T12:00:00.000Z" },
        T0,
      ),
    ).toEqual({ kind: "unknown" });
  });
});
