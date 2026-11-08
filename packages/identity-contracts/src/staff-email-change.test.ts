import { describe, expect, it } from "vitest";
import {
  STAFF_EMAIL_CHANGE_CANCEL_SUBROUTE,
  STAFF_EMAIL_CHANGE_FAILURES,
  STAFF_EMAIL_CHANGE_MACHINE_SCOPE,
  staffEmailChangeCancelRequestSchema,
  staffEmailChangeCancelledSchema,
  staffEmailChangeRequestSchema,
} from "./staff-email-change.js";

const valid = {
  newEmail: "  New.Address@Example.com ",
  actorSubjectId: "staff-1",
  reason: "Lost access to the old mailbox; caller matched the KYC record.",
  proof: { kind: "kyc_match", kycSessionId: "kyc-1" },
} as const;

describe("staff email change request", () => {
  it("has its own scope, apart from the other machine credentials", () => {
    expect(STAFF_EMAIL_CHANGE_MACHINE_SCOPE).toBe("staff_email_change");
  });

  it("normalises the new address", () => {
    const parsed = staffEmailChangeRequestSchema.parse(valid);
    expect(parsed.newEmail).toBe("new.address@example.com");
  });

  it("requires a reason of useful length", () => {
    expect(staffEmailChangeRequestSchema.safeParse({ ...valid, reason: "short" }).success).toBe(
      false,
    );
  });

  it("accepts a fresh ID check only with a reference", () => {
    const withReference = {
      ...valid,
      proof: { kind: "id_check", reference: "IDV-2291" },
    };
    expect(staffEmailChangeRequestSchema.safeParse(withReference).success).toBe(true);
    const without = { ...valid, proof: { kind: "id_check", reference: " " } };
    expect(staffEmailChangeRequestSchema.safeParse(without).success).toBe(false);
  });

  it("refuses a proof kind it does not know", () => {
    const unknown = { ...valid, proof: { kind: "phone_call" } };
    expect(staffEmailChangeRequestSchema.safeParse(unknown).success).toBe(false);
  });

  it("refuses a KYC match with no record to point at", () => {
    const unknown = { ...valid, proof: { kind: "kyc_match" } };
    expect(staffEmailChangeRequestSchema.safeParse(unknown).success).toBe(false);
  });
});

describe("staff email change cancel", () => {
  it("is its own route under the same credential", () => {
    expect(STAFF_EMAIL_CHANGE_CANCEL_SUBROUTE).toBe(
      "/subjects/:subjectId/staff-email-change/cancel",
    );
  });

  it("needs the actor and a reason of useful length", () => {
    const valid = { actorSubjectId: " staff-1 ", reason: "Caller found the old mailbox again." };
    expect(staffEmailChangeCancelRequestSchema.parse(valid).actorSubjectId).toBe("staff-1");
    expect(
      staffEmailChangeCancelRequestSchema.safeParse({ ...valid, reason: "short" }).success,
    ).toBe(false);
    expect(staffEmailChangeCancelRequestSchema.safeParse({ reason: valid.reason }).success).toBe(
      false,
    );
  });

  it("answers only that it is cancelled", () => {
    expect(staffEmailChangeCancelledSchema.safeParse({ cancelled: true }).success).toBe(true);
    expect(
      staffEmailChangeCancelledSchema.safeParse({ cancelled: true, email: "a@b.co" }).success,
    ).toBe(false);
  });

  it("can refuse because nothing is waiting", () => {
    expect(STAFF_EMAIL_CHANGE_FAILURES).toContain("none_in_progress");
  });
});
