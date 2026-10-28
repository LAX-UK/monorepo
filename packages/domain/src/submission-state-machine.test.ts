import { describe, expect, it } from "vitest";
import {
  canTransition,
  nextStatus,
  sellerCanEditSubmission,
  sellerSubmitTransition,
  transitionErrorMessage,
} from "./submission-state-machine.js";

describe("submission-state-machine", () => {
  it("allows submit from draft", () => {
    expect(canTransition("draft", "submit")).toBe(true);
    expect(nextStatus("draft", "submit")).toBe("submitted");
  });

  it("allows accept then convert", () => {
    expect(nextStatus("under_review", "accept")).toBe("approved");
    expect(nextStatus("approved", "convert")).toBe("converted");
  });

  it("rejects convert from under_review", () => {
    expect(canTransition("under_review", "convert")).toBe(false);
  });

  describe("needs changes", () => {
    it("lets a specialist ask for changes only while reviewing", () => {
      expect(nextStatus("under_review", "requestChanges")).toBe("changes_requested");
      for (const from of ["draft", "submitted", "approved", "rejected", "converted"] as const) {
        expect(canTransition(from, "requestChanges")).toBe(false);
      }
    });

    it("sends a resubmission back to the review queue", () => {
      expect(nextStatus("changes_requested", "resubmit")).toBe("submitted");
      expect(canTransition("draft", "resubmit")).toBe(false);
      expect(canTransition("under_review", "resubmit")).toBe(false);
    });

    it("lets the seller edit drafts and submissions that need changes, nothing else", () => {
      expect(sellerCanEditSubmission("draft")).toBe(true);
      expect(sellerCanEditSubmission("changes_requested")).toBe(true);
      for (const status of ["submitted", "under_review", "approved", "converted"] as const) {
        expect(sellerCanEditSubmission(status)).toBe(false);
      }
    });

    it("picks submit or resubmit for the seller's one Submit button", () => {
      expect(sellerSubmitTransition("draft")).toBe("submit");
      expect(sellerSubmitTransition("changes_requested")).toBe("resubmit");
      expect(sellerSubmitTransition("submitted")).toBeNull();
    });

    it("lets the seller withdraw while changes are asked for", () => {
      expect(nextStatus("changes_requested", "withdraw")).toBe("withdrawn");
    });

    it("explains refused moves", () => {
      expect(transitionErrorMessage("submitted", "requestChanges")).toMatch(/under review/);
    });
  });

  it("throws on an invalid transition", () => {
    expect(() => nextStatus("rejected", "submit")).toThrow(/Invalid transition/);
  });
});
