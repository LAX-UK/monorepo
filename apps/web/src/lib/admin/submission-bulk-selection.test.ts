import { describe, expect, it } from "vitest";
import {
  areSubmissionBulkIdsActionable,
  mergeSubmissionStatuses,
} from "./submission-bulk-selection";

describe("mergeSubmissionStatuses", () => {
  it("adds statuses from rows while preserving prior entries", () => {
    const prev = new Map([["a", "submitted"]]);
    const next = mergeSubmissionStatuses(prev, [
      { id: "b", status: "under_review", blocksAccept: false },
      { id: "a", status: "under_review", blocksAccept: false },
    ]);
    expect(next.get("a")).toBe("under_review");
    expect(next.get("b")).toBe("under_review");
  });
});

describe("areSubmissionBulkIdsActionable", () => {
  const statusById = new Map([
    ["review-1", "under_review"],
    ["review-2", "under_review"],
    ["submitted-1", "submitted"],
    ["blocked-1", "under_review"],
  ]);
  const blocksAcceptById = new Map([
    ["review-1", false],
    ["review-2", false],
    ["blocked-1", true],
  ]);

  it("returns false when nothing is selected", () => {
    expect(areSubmissionBulkIdsActionable([], statusById, blocksAcceptById)).toBe(false);
  });

  it("returns true when all selected ids are under review without blocks", () => {
    expect(
      areSubmissionBulkIdsActionable(["review-1", "review-2"], statusById, blocksAcceptById),
    ).toBe(true);
  });

  it("returns false when any selected id is not under review", () => {
    expect(
      areSubmissionBulkIdsActionable(["review-1", "submitted-1"], statusById, blocksAcceptById),
    ).toBe(false);
  });

  it("returns false when any selected id blocks accept", () => {
    expect(
      areSubmissionBulkIdsActionable(["review-1", "blocked-1"], statusById, blocksAcceptById),
    ).toBe(false);
  });

  it("returns false when a selected id has no known status (cross-page gap)", () => {
    expect(
      areSubmissionBulkIdsActionable(["review-1", "unknown-id"], statusById, blocksAcceptById),
    ).toBe(false);
  });
});
