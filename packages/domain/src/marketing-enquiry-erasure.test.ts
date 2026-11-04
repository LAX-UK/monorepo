import { describe, expect, it } from "vitest";
import {
  ENQUIRY_ERASURE_HOLD_STATUSES,
  ERASED_ENQUIRY,
  isEnquiryHeldFromErasure,
} from "./marketing-enquiry-erasure.js";
import { ENQUIRY_STATUSES } from "./marketing-enquiry-vocabulary.js";

describe("enquiry erasure policy", () => {
  it("holds a converted enquiry, which belongs to its deal, and no other", () => {
    expect(ENQUIRY_ERASURE_HOLD_STATUSES).toEqual(["converted"]);
    for (const status of ENQUIRY_STATUSES) {
      expect(isEnquiryHeldFromErasure(status)).toBe(status === "converted");
    }
  });

  it("replaces the email with an address that can never receive mail", () => {
    expect(ERASED_ENQUIRY.email.endsWith(".invalid")).toBe(true);
  });
});
