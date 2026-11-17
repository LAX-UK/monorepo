import { describe, expect, it } from "vitest";
import { devSeedNeedsEmptyDatabase } from "./dev-seed-guard.js";

describe("devSeedNeedsEmptyDatabase", () => {
  it("checks for users on any database that is not hermetic, whatever its address", () => {
    expect(devSeedNeedsEmptyDatabase({ hermetic: false, allowDestructive: undefined })).toBe(true);
  });

  it("skips the check on a hermetic database", () => {
    expect(devSeedNeedsEmptyDatabase({ hermetic: true, allowDestructive: undefined })).toBe(false);
  });

  it("skips the check only when SEED_ALLOW_DESTRUCTIVE is exactly 1", () => {
    expect(devSeedNeedsEmptyDatabase({ hermetic: false, allowDestructive: "1" })).toBe(false);
    expect(devSeedNeedsEmptyDatabase({ hermetic: false, allowDestructive: "true" })).toBe(true);
  });
});
