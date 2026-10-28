import { describe, expect, it } from "vitest";
import { submissionSellerWait } from "./submission-seller-wait";

const complete = {
  acceptedAt: null,
  estimateLow: "8000",
  estimateHigh: "12000",
  commissionPercent: "15",
};

describe("submissionSellerWait", () => {
  it("shows accepted work waiting for the seller's agreement", () => {
    expect(submissionSellerWait("approved", complete)).toEqual({
      label: "Waiting for the seller",
      tone: "info",
    });
  });

  it("asks staff to add terms the seller cannot yet accept", () => {
    expect(submissionSellerWait("approved", null)).toEqual({
      label: "Add the terms",
      tone: "warning",
    });
    expect(submissionSellerWait("approved", { ...complete, commissionPercent: null })?.label).toBe(
      "Add the terms",
    );
  });

  it("shows nothing once accepted or for other statuses", () => {
    expect(submissionSellerWait("approved", { ...complete, acceptedAt: new Date() })).toBeNull();
    expect(submissionSellerWait("under_review", complete)).toBeNull();
    expect(submissionSellerWait("converted", null)).toBeNull();
  });
});
