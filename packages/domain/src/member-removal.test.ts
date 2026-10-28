import { describe, expect, it } from "vitest";
import { stopsOnRemoval } from "./member-removal.js";

describe("stopsOnRemoval", () => {
  it("stops auto-bid ceilings on lots that can still take bids", () => {
    expect(stopsOnRemoval({ kind: "auto_bid", lotStatus: "active", instructionStatus: null })).toBe(
      true,
    );
    expect(
      stopsOnRemoval({ kind: "auto_bid", lotStatus: "scheduled", instructionStatus: null }),
    ).toBe(true);
    expect(stopsOnRemoval({ kind: "auto_bid", lotStatus: "ended", instructionStatus: null })).toBe(
      false,
    );
  });

  it("stops absentee bids that have not run, and leaves the rest", () => {
    expect(
      stopsOnRemoval({ kind: "absentee", lotStatus: "scheduled", instructionStatus: "scheduled" }),
    ).toBe(true);
    for (const status of ["executing", "executed", "lost", "cancelled", "voided"]) {
      expect(
        stopsOnRemoval({ kind: "absentee", lotStatus: "active", instructionStatus: status }),
      ).toBe(false);
    }
  });
});
