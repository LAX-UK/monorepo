import { describe, expect, it } from "vitest";
import {
  acceptConsignmentAgreementBodySchema,
  acceptSubmissionBodySchema,
  requestSubmissionChangesBodySchema,
} from "./item-submission.js";

describe("acceptSubmissionBodySchema", () => {
  it("accepts a proposal with an estimate, reserve and commission", () => {
    expect(
      acceptSubmissionBodySchema.safeParse({
        estimateLow: "8000",
        estimateHigh: "12000.50",
        reservePrice: "7000",
        commissionPercent: "12.5",
      }).success,
    ).toBe(true);
  });

  it("accepts without any figures", () => {
    expect(acceptSubmissionBodySchema.safeParse({}).success).toBe(true);
  });

  it("asks for both ends of the estimate", () => {
    const result = acceptSubmissionBodySchema.safeParse({ estimateLow: "8000" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["estimateHigh"]);
  });

  it("refuses a high estimate below the low one", () => {
    expect(
      acceptSubmissionBodySchema.safeParse({ estimateLow: "9000", estimateHigh: "8000" }).success,
    ).toBe(false);
  });

  it("refuses a commission of 100% or more", () => {
    expect(acceptSubmissionBodySchema.safeParse({ commissionPercent: "100" }).success).toBe(false);
  });
});

describe("requestSubmissionChangesBodySchema", () => {
  it("needs a note for the seller", () => {
    expect(requestSubmissionChangesBodySchema.safeParse({ note: "   " }).success).toBe(false);
    expect(requestSubmissionChangesBodySchema.parse({ note: " Add a photo " })).toEqual({
      note: "Add a photo",
    });
  });
});

describe("acceptConsignmentAgreementBodySchema", () => {
  it("needs the version the seller read", () => {
    expect(acceptConsignmentAgreementBodySchema.safeParse({}).success).toBe(false);
    expect(
      acceptConsignmentAgreementBodySchema.safeParse({
        termsVersion: "conditions-of-business-part-c-v1",
      }).success,
    ).toBe(true);
  });
});
