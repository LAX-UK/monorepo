import { describe, expect, it } from "vitest";
import {
  invitationCanResend,
  invitationCanRevoke,
  invitationResendDisabledReason,
  invitationRevokeDisabledReason,
} from "./invite-lifecycle";

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe("invitationCanResend", () => {
  it("allows pending invitations", () => {
    expect(
      invitationCanResend({
        status: "pending",
        expiresAt: future,
        openedAt: null,
        inviteEmailLastStatus: null,
      }),
    ).toBe(true);
  });

  it("allows expired invitations", () => {
    expect(
      invitationCanResend({
        status: "expired",
        expiresAt: past,
        openedAt: null,
        inviteEmailLastStatus: null,
      }),
    ).toBe(true);
  });

  it("denies accepted and revoked", () => {
    expect(
      invitationCanResend({
        status: "accepted",
        expiresAt: future,
        openedAt: null,
        inviteEmailLastStatus: null,
      }),
    ).toBe(false);
    expect(
      invitationCanResend({
        status: "revoked",
        expiresAt: future,
        openedAt: null,
        inviteEmailLastStatus: null,
      }),
    ).toBe(false);
  });
});

describe("invitationCanRevoke", () => {
  it("allows pending non-expired invitations", () => {
    expect(
      invitationCanRevoke({
        status: "pending",
        expiresAt: future,
        openedAt: null,
        inviteEmailLastStatus: null,
      }),
    ).toBe(true);
  });

  it("denies clock-expired pending invitations", () => {
    expect(
      invitationCanRevoke({
        status: "pending",
        expiresAt: past,
        openedAt: null,
        inviteEmailLastStatus: null,
      }),
    ).toBe(false);
  });

  it("denies terminal statuses", () => {
    for (const status of ["accepted", "revoked", "expired"] as const) {
      expect(
        invitationCanRevoke({
          status,
          expiresAt: future,
          openedAt: null,
          inviteEmailLastStatus: null,
        }),
      ).toBe(false);
    }
  });
});

describe("disabled reasons", () => {
  it("returns null when action is allowed", () => {
    const row = {
      status: "pending",
      expiresAt: future,
      openedAt: null,
      inviteEmailLastStatus: null,
    };
    expect(invitationResendDisabledReason(row)).toBeNull();
    expect(invitationRevokeDisabledReason(row)).toBeNull();
  });

  it("explains expired revoke", () => {
    expect(
      invitationRevokeDisabledReason({
        status: "pending",
        expiresAt: past,
        openedAt: null,
        inviteEmailLastStatus: null,
      }),
    ).toBe("Expired — resend to issue a new link");
  });
});
