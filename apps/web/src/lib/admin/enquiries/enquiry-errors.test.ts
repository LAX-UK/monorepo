import { describe, expect, it } from "vitest";
import { enquiryErrorMessage, isStaleEnquiry } from "./enquiry-errors";

describe("enquiryErrorMessage", () => {
  it("says the API's own refusal in a sentence", () => {
    expect(enquiryErrorMessage("close_reason_required", 422)).toBe(
      "Choose why you're closing this enquiry.",
    );
    expect(enquiryErrorMessage("stale_version", 409)).toMatch(/changed/);
  });

  it("says nothing was changed when the API does not answer", () => {
    expect(enquiryErrorMessage(undefined, undefined)).toMatch(/Nothing was changed/);
    expect(enquiryErrorMessage("unknown_code", 503)).toMatch(/Nothing was changed/);
  });

  it("says when the person may not change enquiries", () => {
    expect(enquiryErrorMessage(undefined, 403)).toMatch(/permission/);
  });

  it("recognises a stale edit", () => {
    expect(isStaleEnquiry("stale_version")).toBe(true);
    expect(isStaleEnquiry("unchanged")).toBe(false);
  });
});
