import type { ItemSubmissionStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { consignmentJourney, journeyCaption, journeyProgress } from "./consignment-journey";

describe("consignmentJourney", () => {
  it("follows a submission through review and the agreement", () => {
    const at = (status: ItemSubmissionStatus, agreement: "none" | "open" | "accepted" = "open") =>
      consignmentJourney({ submissionStatus: status, agreement, lot: null })?.current;
    expect(at("draft")).toBe("submitted");
    expect(at("under_review")).toBe("review");
    expect(at("changes_requested")).toBe("review");
    expect(at("approved")).toBe("agreement");
    expect(at("approved", "accepted")).toBe("catalogued");
    expect(at("rejected")).toBeUndefined();
  });

  it("goes on to cataloguing when no terms wait, as the status badge says", () => {
    expect(
      consignmentJourney({ submissionStatus: "approved", agreement: "none", lot: null })?.current,
    ).toBe("catalogued");
  });

  it("follows the lot once there is one", () => {
    const lot = (status: "draft" | "active" | "ended" | "cancelled", sold = false) =>
      consignmentJourney({
        submissionStatus: "converted",
        agreement: "accepted",
        lot: { status, sold },
      });
    expect(lot("draft")?.current).toBe("catalogued");
    expect(lot("active")?.current).toBe("in-sale");
    expect(lot("ended", true)).toEqual({ current: "sold", finished: true });
    expect(lot("cancelled")).toBeNull();
  });

  it("marks steps done up to the current one and captions it", () => {
    const journey = { current: "agreement" as const, finished: false };
    expect(journeyProgress(journey).map((step) => step.progress)).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(journeyCaption(journey)).toBe("Agreement, step 3 of 6");
    expect(
      journeyProgress({ current: "sold", finished: true }).every(
        (step) => step.progress === "done",
      ),
    ).toBe(true);
  });
});
