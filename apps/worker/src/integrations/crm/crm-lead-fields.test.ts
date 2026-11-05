import { describe, expect, it } from "vitest";
import { consentFields, enquiryTypeFor, interestFields, newLeadFields } from "./crm-lead-fields.js";

describe("consentFields", () => {
  it("is not opted in without an explicit opt-in and carries no timestamp or source", () => {
    expect(consentFields({ optIn: false, at: new Date("2026-11-03T09:00:00Z") })).toEqual({
      Consent_Marketing_Opt_In: false,
      Email_Opt_Out: true,
    });
  });

  it("records the day, the website source and the wording version of an opt-in", () => {
    expect(
      consentFields({ optIn: true, at: "2026-10-30T23:30:00.000Z", wordingVersion: "2026-10" }),
    ).toEqual({
      Consent_Marketing_Opt_In: true,
      Email_Opt_Out: false,
      Consent_Timestamp: "2026-10-30",
      Consent_Source: "Website",
      Consent_Wording_Version: "2026-10",
    });
  });

  it("omits the timestamp when the opt-in time is unknown", () => {
    const fields = consentFields({ optIn: true, at: null });
    expect(fields).not.toHaveProperty("Consent_Timestamp");
    expect(fields.Consent_Source).toBe("Website");
  });
});

describe("enquiryTypeFor", () => {
  it("falls back to General", () => {
    expect(enquiryTypeFor("shipping", null)).toBe("General");
    expect(enquiryTypeFor("general", "unknown-department")).toBe("General");
  });
});

describe("interestFields", () => {
  it("trims the artist and skips blanks", () => {
    expect(interestFields("  Mr Phantom ")).toEqual({ Interested_Artist: "Mr Phantom" });
    expect(interestFields("   ")).toEqual({});
    expect(interestFields(undefined)).toEqual({});
  });
});

describe("newLeadFields", () => {
  it("uses the configured status", () => {
    expect(newLeadFields("New")).toEqual({ Lead_Status: "New", Lead_Source: "Website" });
  });
});
