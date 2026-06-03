import { describe, expect, it } from "vitest";
import { marketingContactSkipReason } from "./eligibility.js";

const eligibleRow = {
  email: "a@b.com",
  emailVerified: true,
  role: "client",
  emailStatus: "ok",
  suspendedAt: null,
  deletionRequestedAt: null,
};

describe("marketingContactSkipReason", () => {
  it("returns null for an eligible user", () => {
    expect(marketingContactSkipReason(eligibleRow, false)).toBeNull();
  });

  it("does not skip unverified email (EMAIL_VERIFIED is sent to Brevo)", () => {
    expect(marketingContactSkipReason({ ...eligibleRow, emailVerified: false }, false)).toBeNull();
  });

  it("skips staff role", () => {
    expect(marketingContactSkipReason({ ...eligibleRow, role: "staff" }, false)).toBe(
      "excluded_role",
    );
  });

  it("skips non-ok email_status", () => {
    expect(marketingContactSkipReason({ ...eligibleRow, emailStatus: "bounced" }, false)).toBe(
      "email_status",
    );
  });

  it("skips suspended users", () => {
    expect(marketingContactSkipReason({ ...eligibleRow, suspendedAt: new Date() }, false)).toBe(
      "suspended",
    );
  });

  it("skips suppressed addresses", () => {
    expect(marketingContactSkipReason(eligibleRow, true)).toBe("suppressed");
  });

  it("returns deletion_requested when deletion is pending (upsert path only)", () => {
    expect(
      marketingContactSkipReason({ ...eligibleRow, deletionRequestedAt: new Date() }, false),
    ).toBe("deletion_requested");
  });
});
