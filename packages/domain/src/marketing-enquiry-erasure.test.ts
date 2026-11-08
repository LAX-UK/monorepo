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

  it("releases the hold once every deal made from the enquiry has ended", () => {
    expect(isEnquiryHeldFromErasure("converted", ["offer"])).toBe(true);
    expect(isEnquiryHeldFromErasure("converted", ["invoiced"])).toBe(true);
    expect(isEnquiryHeldFromErasure("converted", ["settled"])).toBe(false);
    expect(isEnquiryHeldFromErasure("converted", ["cancelled"])).toBe(false);
    expect(isEnquiryHeldFromErasure("converted", ["cancelled", "settled"])).toBe(false);
    // A deal still open keeps it, even next to one that ended.
    expect(isEnquiryHeldFromErasure("converted", ["cancelled", "paid"])).toBe(true);
  });

  it("keeps a converted enquiry with no deal held, because nothing shows its deal is finished", () => {
    expect(isEnquiryHeldFromErasure("converted", [])).toBe(true);
    expect(isEnquiryHeldFromErasure("converted")).toBe(true);
  });

  it("never holds an enquiry that was not converted, whatever deals exist", () => {
    expect(isEnquiryHeldFromErasure("closed", ["offer"])).toBe(false);
  });

  it("replaces the email with an address that can never receive mail", () => {
    expect(ERASED_ENQUIRY.email.endsWith(".invalid")).toBe(true);
  });
});
