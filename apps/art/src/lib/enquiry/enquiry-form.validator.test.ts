import { describe, expect, it } from "vitest";
import {
  ENQUIRY_MESSAGE_MAX_LENGTH,
  normalizeEnquiryPhone,
  validateEnquiryEmail,
  validateEnquiryForm,
  validateEnquiryName,
} from "./enquiry-form.validator.js";

const CONTACT = { name: "Grace Hopper", email: "grace@example.com" };

describe("enquiry form validator", () => {
  it("accepts name and email alone and sends only the intent and contact", () => {
    expect(validateEnquiryForm({ ...CONTACT, message: "  ", contactPhone: "" })).toEqual({
      ok: true,
      payload: { intent: "enquiry", ...CONTACT },
    });
  });

  it("trims every field and normalises the phone to E.164", () => {
    expect(
      validateEnquiryForm({
        name: "  Grace Hopper ",
        email: " grace@example.com ",
        message: "  Is it framed?  ",
        contactPhone: "+44 (0)20 7946-0958",
      }),
    ).toEqual({
      ok: true,
      payload: {
        intent: "enquiry",
        ...CONTACT,
        message: "Is it framed?",
        contactPhone: "+442079460958",
      },
    });
  });

  it("converts a 00 international prefix", () => {
    expect(normalizeEnquiryPhone("0033 1 23 45 67 89")).toBe("+33123456789");
  });

  it("requires a name and an email", () => {
    const result = validateEnquiryForm({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.name).toMatch(/name/);
      expect(result.fieldErrors.email).toMatch(/email/);
    }
  });

  it.each(["grace", "grace@", "@example.com", "grace@example", "gr ace@example.com"])(
    "rejects the email %j",
    (email) => {
      expect(validateEnquiryEmail(email)).toMatch(/valid email/);
    },
  );

  it("bounds the name and the email length", () => {
    expect(validateEnquiryName("n".repeat(121))).toMatch(/120/);
    expect(validateEnquiryEmail(`${"a".repeat(250)}@example.com`)).toMatch(/valid email/);
  });

  it("rejects numbers without a country code", () => {
    const result = validateEnquiryForm({ ...CONTACT, contactPhone: "020 7946 0958" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.contactPhone).toMatch(/country code/);
  });

  it("rejects messages over the limit", () => {
    const result = validateEnquiryForm({
      ...CONTACT,
      message: "x".repeat(ENQUIRY_MESSAGE_MAX_LENGTH + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.message).toMatch(/2000/);
  });

  it("ignores non-string values", () => {
    const result = validateEnquiryForm({ name: 1, email: null, message: 42, contactPhone: null });
    expect(result.ok).toBe(false);
  });
});
