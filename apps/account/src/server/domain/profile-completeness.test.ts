import { describe, expect, it } from "vitest";
import { profileGaps } from "./profile-completeness";

const complete = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  emailVerified: true,
};

describe("profileGaps", () => {
  it("is empty for a complete, verified account", () => {
    expect(profileGaps(complete)).toEqual([]);
  });

  it("lists a missing name and an unverified email in screen order", () => {
    expect(profileGaps({ name: null, email: "ada@example.com", emailVerified: false })).toEqual([
      "name",
      "email-verification",
    ]);
  });

  it("does not ask to verify an email the account does not have", () => {
    expect(profileGaps({ ...complete, email: null, emailVerified: false })).toEqual([]);
  });
});
