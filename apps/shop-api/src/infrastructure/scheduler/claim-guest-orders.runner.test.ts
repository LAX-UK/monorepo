import { describe, expect, it } from "vitest";
import { verifiedEmailFromEvent } from "./claim-guest-orders.runner.js";

const AT = "2026-10-30T12:00:00.000Z";

describe("verifiedEmailFromEvent", () => {
  it("claims on a sign-up's verified email", () => {
    expect(
      verifiedEmailFromEvent("user.email_verified", {
        userId: "user_1",
        email: "ada@example.com",
        verifiedAt: AT,
      }),
    ).toEqual({ subjectId: "user_1", email: "ada@example.com" });
  });

  it("claims on a change of email both inboxes confirmed", () => {
    expect(
      verifiedEmailFromEvent("user.profile_updated", {
        schemaVersion: 1,
        subjectId: "user_1",
        email: "new@example.com",
        emailVerified: true,
        updatedAt: AT,
      }),
    ).toEqual({ subjectId: "user_1", email: "new@example.com" });
  });

  it("ignores a profile update that does not prove the email", () => {
    expect(
      verifiedEmailFromEvent("user.profile_updated", {
        schemaVersion: 1,
        subjectId: "user_1",
        email: "new@example.com",
        updatedAt: AT,
      }),
    ).toBeNull();
    expect(
      verifiedEmailFromEvent("user.profile_updated", {
        schemaVersion: 1,
        subjectId: "user_1",
        name: "Ada",
        emailVerified: true,
        updatedAt: AT,
      }),
    ).toBeNull();
    expect(verifiedEmailFromEvent("user.registered", { userId: "user_1" })).toBeNull();
  });
});
