import { describe, expect, it } from "vitest";
import { nextRestoreStep } from "./restore-loop";

describe("nextRestoreStep", () => {
  it("leaves a browser with an account alone, marker or not", () => {
    expect(nextRestoreStep({ needsRestore: false, markerPresent: false })).toBe("none");
    expect(nextRestoreStep({ needsRestore: false, markerPresent: true })).toBe("none");
  });

  it("hops once for a browser that has no usable account", () => {
    expect(nextRestoreStep({ needsRestore: true, markerPresent: false })).toBe("hop");
  });

  it("stops when a restore has only just run and the browser still has no account", () => {
    expect(nextRestoreStep({ needsRestore: true, markerPresent: true })).toBe("stalled");
  });
});
