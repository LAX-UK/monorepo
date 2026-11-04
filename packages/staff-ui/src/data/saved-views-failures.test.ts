import { describe, expect, it } from "vitest";
import { savedViewsFailure } from "./saved-views-failures.js";
import { SavedViewsError } from "./saved-views.js";

describe("savedViewsFailure", () => {
  it("raises saved-view errors with a code the interface can act on", () => {
    const unreachable = savedViewsFailure.unreachable();
    expect(unreachable).toBeInstanceOf(SavedViewsError);
    expect([unreachable.code, unreachable.message]).toEqual([
      "failed",
      "Could not reach the server. Try again.",
    ]);
    expect(savedViewsFailure.unknown().message).toBe("Something went wrong. Try again.");
    const missing = savedViewsFailure.missing();
    expect([missing.code, missing.message]).toEqual(["stale", "That view no longer exists."]);
  });
});
