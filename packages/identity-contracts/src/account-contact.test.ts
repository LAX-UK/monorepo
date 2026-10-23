import { describe, expect, it } from "vitest";
import {
  ACCOUNT_CONTACT_ERRORS,
  ACCOUNT_PHONE_CODE_LENGTH,
  accountContactSchema,
  accountEmailChangeConfirmedSchema,
  accountEmailSchema,
  accountPhoneCodeSchema,
  accountPhoneSchema,
} from "./account-contact.js";

describe("accountPhoneSchema", () => {
  it.each(["+447700900123", "+14155550100", "+971500000000"])("accepts %s", (phone) => {
    expect(accountPhoneSchema.safeParse(phone).success).toBe(true);
  });

  it.each([
    ["no country code", "07700900123"],
    ["a leading zero after the plus", "+0447700900123"],
    ["letters", "+4477009OO123"],
    ["spaces", "+44 7700 900123"],
    ["too short", "+44123"],
    ["too long", "+1234567890123456"],
  ])("rejects a number with %s", (_label, phone) => {
    expect(accountPhoneSchema.safeParse(phone).success).toBe(false);
  });
});

describe("accountPhoneCodeSchema", () => {
  it("accepts exactly the provider's code length in digits", () => {
    expect(accountPhoneCodeSchema.safeParse("1".repeat(ACCOUNT_PHONE_CODE_LENGTH)).success).toBe(
      true,
    );
    expect(accountPhoneCodeSchema.safeParse("12345").success).toBe(false);
    expect(accountPhoneCodeSchema.safeParse("1234567").success).toBe(false);
    expect(accountPhoneCodeSchema.safeParse("12345a").success).toBe(false);
  });
});

describe("accountEmailSchema", () => {
  it("trims and lower-cases, so the same address is never stored two ways", () => {
    expect(accountEmailSchema.parse("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("rejects what is not an address and what is too long", () => {
    expect(accountEmailSchema.safeParse("ada").success).toBe(false);
    expect(accountEmailSchema.safeParse(`${"a".repeat(250)}@example.com`).success).toBe(false);
  });
});

describe("responses", () => {
  it("parses the contact details with and without a pending change", () => {
    const base = { email: "a@b.co", emailVerified: true, phone: null, phoneVerified: false };
    expect(accountContactSchema.parse({ ...base, pendingEmail: null }).pendingEmail).toBeNull();
    expect(accountContactSchema.parse({ ...base, pendingEmail: "n@b.co" }).pendingEmail).toBe(
      "n@b.co",
    );
  });

  it("requires a confirmation to say which inbox it was", () => {
    expect(
      accountEmailChangeConfirmedSchema.safeParse({ completed: false, confirmedFor: "someone" })
        .success,
    ).toBe(false);
  });

  it("lists each refusal once", () => {
    expect(new Set(ACCOUNT_CONTACT_ERRORS).size).toBe(ACCOUNT_CONTACT_ERRORS.length);
  });
});
