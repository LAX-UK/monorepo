import { describe, expect, it } from "vitest";
import { CLOCK_CORRECTION_THRESHOLD_MS, createClockSource } from "./clock-source.js";

function readers(wall: number, mono: number) {
  const state = { wall, mono };
  return {
    state,
    wallNow: () => state.wall,
    monotonicNow: () => state.mono,
  };
}

describe("createClockSource", () => {
  it("starts from the wall clock and follows the monotonic clock", () => {
    const r = readers(1_000_000, 50);
    const source = createClockSource(r);
    expect(source.now()).toBe(1_000_000);
    r.state.mono += 2_000;
    expect(source.now()).toBe(1_002_000);
  });

  it("changing the device clock mid-session changes nothing", () => {
    const r = readers(1_000_000, 50);
    const source = createClockSource(r);
    r.state.mono += 1_000;
    r.state.wall -= 3_600_000; // the visitor sets their clock back an hour
    expect(source.now()).toBe(1_001_000);
  });

  it("uses the page's server reading until a measurement lands, then ignores seeds", () => {
    const r = readers(1_000_000, 50);
    const source = createClockSource(r);
    source.seedProvisional(5_000_000);
    expect(source.now()).toBe(5_000_000);
    source.applyMeasurement(9_000_000, 50);
    expect(source.isMeasured()).toBe(true);
    source.seedProvisional(1);
    expect(source.now()).toBe(9_000_000);
  });

  it("ignores a correction under the threshold and applies a larger one", () => {
    const r = readers(1_000_000, 0);
    const source = createClockSource(r);
    source.applyMeasurement(1_000_000 + CLOCK_CORRECTION_THRESHOLD_MS - 1, 0);
    expect(source.now()).toBe(1_000_000);
    source.applyMeasurement(1_000_000 + 3_000, 0);
    expect(source.now()).toBe(1_003_000);
  });

  it("never goes backwards: a correction behind holds the clock until time catches up", () => {
    const r = readers(1_000_000, 0);
    const source = createClockSource(r);
    r.state.mono = 10_000;
    expect(source.now()).toBe(1_010_000);
    // the device was 4 s ahead of the server
    source.applyMeasurement(1_006_000, 10_000);
    expect(source.now()).toBe(1_010_000);
    r.state.mono = 12_000;
    expect(source.now()).toBe(1_010_000);
    r.state.mono = 14_500;
    expect(source.now()).toBe(1_010_500);
  });
});
