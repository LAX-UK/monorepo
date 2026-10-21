import { describe, expect, it } from "vitest";
import { profileGaps } from "./profile-completeness";

const complete = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  emailVerified: true,
  phone: "+447700900000",
};

describe("profileGaps", () => {
  it("is empty for a complete, verified account", () => {
    expect(profileGaps(complete, { profileEditable: true })).toEqual([]);
  });

  it("lists missing name, unverified email and missing phone in screen order", () => {
    expect(
      profileGaps(
        { name: null, email: "ada@example.com", emailVerified: false, phone: null },
        { profileEditable: true },
      ),
    ).toEqual(["name", "email-verification", "phone"]);
  });

  it("ignores gaps that can only be fixed in Bid when Bid is not configured", () => {
    expect(
      profileGaps(
        { name: null, email: "ada@example.com", emailVerified: false, phone: null },
        { profileEditable: false },
      ),
    ).toEqual(["email-verification"]);
  });

  it("does not ask to verify an email the account does not have", () => {
    expect(
      profileGaps({ ...complete, email: null, emailVerified: false }, { profileEditable: true }),
    ).toEqual([]);
  });
});
