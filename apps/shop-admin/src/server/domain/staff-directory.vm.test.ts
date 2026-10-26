import { describe, expect, it } from "vitest";
import {
  STAFF_ROLE_OPTIONS,
  looksLikeEmail,
  staffMemberName,
  staffRoleAllows,
} from "./staff-directory.vm";

describe("a staff member", () => {
  it("is named by their profile name, then their email, never by an account id", () => {
    expect(staffMemberName({ displayName: "Ada Lovelace", email: "ada@lax.art" })).toBe(
      "Ada Lovelace",
    );
    expect(staffMemberName({ displayName: null, email: "ada@lax.art" })).toBe("ada@lax.art");
    expect(staffMemberName({ displayName: null, email: null })).toBe("Name not set yet");
  });
});

describe("the roles LAX Admin grants", () => {
  it("each say in plain words what they allow", () => {
    for (const option of STAFF_ROLE_OPTIONS) {
      expect(option.label).not.toMatch(/_/);
      expect(option.description).toMatch(/\.$/);
    }
    expect(staffRoleAllows("finance")).toBe(
      "Orders, refunds, payouts, edition prices and the audit log.",
    );
    expect(staffRoleAllows("wizard")).toBeNull();
  });

  it("check an email before asking the API", () => {
    expect(looksLikeEmail(" sam@lax.art ")).toBe(true);
    expect(looksLikeEmail("sam@lax")).toBe(false);
  });
});
