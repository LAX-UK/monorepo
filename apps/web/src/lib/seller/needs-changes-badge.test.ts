import { describe, expect, it } from "vitest";
import { needsChangesBadge } from "./consignments-list";

describe("needsChangesBadge", () => {
  it("says how many works were sent back", () => {
    expect(needsChangesBadge(3)).toEqual({
      label: "Needs changes",
      count: 3,
      text: "3 need changes",
    });
  });

  it("reads singular for one work", () => {
    expect(needsChangesBadge(1)?.text).toBe("1 needs changes");
  });

  it.each([0, null, undefined, -1])("shows nothing for %s", (n) => {
    expect(needsChangesBadge(n)).toBeNull();
  });
});
