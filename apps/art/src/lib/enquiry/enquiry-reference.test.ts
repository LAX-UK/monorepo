import { describe, expect, it } from "vitest";
import { readEnquiryReference } from "./enquiry-reference";

describe("readEnquiryReference", () => {
  it("reads a stored enquiry's reference", () => {
    expect(readEnquiryReference({ status: "registered", reference: "E-2041" })).toBe("E-2041");
  });

  it("returns null when the response has none or it is malformed", () => {
    expect(readEnquiryReference({ status: "registered" })).toBeNull();
    expect(readEnquiryReference({ reference: "<b>" })).toBeNull();
    expect(readEnquiryReference(null)).toBeNull();
  });
});
