import { describe, expect, it } from "vitest";
import {
  purchaseProblemNextStatuses,
  purchaseProblemReference,
  purchaseProblemTransitionRefusal,
} from "./purchase-problem.js";

describe("purchaseProblemReference", () => {
  it("is the first eight characters of the case id, upper-cased", () => {
    expect(purchaseProblemReference("3f2a9c1e-7b4d-4e0a-9d1f-5c6b7a8e9f00")).toBe("PR-3F2A9C1E");
  });
});

describe("purchaseProblemTransitionRefusal", () => {
  it("lets an open report be taken on or resolved, and an in-progress one be resolved", () => {
    expect(
      purchaseProblemTransitionRefusal({ from: "open", to: "in_progress", note: undefined }),
    ).toBeNull();
    expect(
      purchaseProblemTransitionRefusal({ from: "open", to: "resolved", note: "Refunded." }),
    ).toBeNull();
    expect(
      purchaseProblemTransitionRefusal({ from: "in_progress", to: "resolved", note: "Done." }),
    ).toBeNull();
  });

  it("requires a note to resolve, and ignores one made of spaces", () => {
    expect(
      purchaseProblemTransitionRefusal({ from: "open", to: "resolved", note: undefined }),
    ).toBe("resolution_note_required");
    expect(purchaseProblemTransitionRefusal({ from: "open", to: "resolved", note: "  " })).toBe(
      "resolution_note_required",
    );
  });

  it("refuses to move backwards, sideways or out of resolved", () => {
    for (const [from, to] of [
      ["in_progress", "open"],
      ["open", "open"],
      ["resolved", "open"],
      ["resolved", "in_progress"],
    ] as const) {
      expect(purchaseProblemTransitionRefusal({ from, to, note: "x" })).toBe("not_allowed");
    }
    expect(purchaseProblemNextStatuses("resolved")).toEqual([]);
  });
});
