import { describe, expect, it } from "vitest";
import {
  ENQUIRY_MESSAGE_MAX_LENGTH,
  normalizeEnquiryPhone,
  validateEnquiryForm,
} from "./enquiry-form.validator.js";

describe("enquiry form validator", () => {
  it("accepts an empty enquiry and sends only the intent", () => {
    expect(validateEnquiryForm({ message: "  ", contactPhone: "" })).toEqual({
      ok: true,
      payload: { intent: "enquiry" },
    });
  });

  it("trims the message and normalises the phone to E.164", () => {
    expect(
      validateEnquiryForm({ message: "  Is it framed?  ", contactPhone: "+44 (0)20 7946-0958" }),
    ).toEqual({
      ok: true,
      payload: { intent: "enquiry", message: "Is it framed?", contactPhone: "+442079460958" },
    });
  });

  it("converts a 00 international prefix", () => {
    expect(normalizeEnquiryPhone("0033 1 23 45 67 89")).toBe("+33123456789");
  });

  it("rejects numbers without a country code", () => {
    const result = validateEnquiryForm({ contactPhone: "020 7946 0958" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.contactPhone).toMatch(/country code/);
  });

  it("rejects messages over the limit", () => {
    const result = validateEnquiryForm({ message: "x".repeat(ENQUIRY_MESSAGE_MAX_LENGTH + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.message).toMatch(/2000/);
  });

  it("ignores non-string values", () => {
    expect(validateEnquiryForm({ message: 42, contactPhone: null })).toEqual({
      ok: true,
      payload: { intent: "enquiry" },
    });
  });
});
