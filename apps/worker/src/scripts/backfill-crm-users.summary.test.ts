import { describe, expect, it } from "vitest";
import { shouldBackfillExitWithError } from "./backfill-crm-users.summary.js";

describe("shouldBackfillExitWithError", () => {
  it("returns true when any row failed", () => {
    expect(
      shouldBackfillExitWithError({ success: 40, error: 3, linkedExisting: 0, skipped: 0 }),
    ).toBe(true);
  });

  it("returns false when there are no errors", () => {
    expect(
      shouldBackfillExitWithError({ success: 40, error: 0, linkedExisting: 0, skipped: 3 }),
    ).toBe(false);
  });
});
