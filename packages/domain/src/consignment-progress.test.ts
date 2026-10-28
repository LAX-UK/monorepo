import { describe, expect, it } from "vitest";
import {
  consignmentProgressCounts,
  consignmentsInProgress,
  lotProgressStage,
  submissionProgressStage,
} from "./consignment-progress.js";

describe("consignment progress", () => {
  it("places each submission status in a stage, leaving drafts and closed work out", () => {
    expect(submissionProgressStage("submitted")).toBe("under_review");
    expect(submissionProgressStage("under_review")).toBe("under_review");
    expect(submissionProgressStage("changes_requested")).toBe("needs_changes");
    expect(submissionProgressStage("approved")).toBe("accepted");
    expect(submissionProgressStage("converted")).toBe("accepted");
    expect(submissionProgressStage("draft")).toBeNull();
    expect(submissionProgressStage("rejected")).toBeNull();
    expect(submissionProgressStage("withdrawn")).toBeNull();
  });

  it("places a catalogued work by its lot, and an ended lot by whether it sold", () => {
    expect(lotProgressStage({ status: "draft", sold: false })).toBe("accepted");
    expect(lotProgressStage({ status: "scheduled", sold: false })).toBe("in_sale");
    expect(lotProgressStage({ status: "active", sold: false })).toBe("in_sale");
    expect(lotProgressStage({ status: "ended", sold: true })).toBe("sold");
    expect(lotProgressStage({ status: "ended", sold: false })).toBe("unsold");
    expect(lotProgressStage({ status: "cancelled", sold: false })).toBeNull();
    expect(lotProgressStage({ status: "voided", sold: false })).toBeNull();
  });

  it("adds submissions and lots into one count per stage", () => {
    const counts = consignmentProgressCounts({
      submissions: [
        { status: "submitted", count: 1 },
        { status: "under_review", count: 2 },
        { status: "changes_requested", count: 1 },
        { status: "draft", count: 5 },
      ],
      lots: [
        { status: "draft", sold: false, count: 1 },
        { status: "active", sold: false, count: 2 },
        { status: "ended", sold: true, count: 3 },
        { status: "ended", sold: false, count: 1 },
        { status: "cancelled", sold: false, count: 4 },
      ],
    });
    expect(counts).toEqual({
      under_review: 3,
      needs_changes: 1,
      accepted: 1,
      in_sale: 2,
      sold: 3,
      unsold: 1,
    });
    expect(consignmentsInProgress(counts)).toBe(11);
  });
});
