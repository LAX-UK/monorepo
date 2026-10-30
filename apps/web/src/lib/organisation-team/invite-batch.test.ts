import { describe, expect, it } from "vitest";
import {
  MAX_INVITES_AT_ONCE,
  inviteBatchProblem,
  inviteEmailProblem,
  normaliseInviteEmail,
  sendInvitesLabel,
  summariseInviteBatch,
} from "./invite-batch";

describe("invite batch", () => {
  it("accepts addresses and flags typos", () => {
    expect(inviteEmailProblem("sam.kerr@northbank.gallery")).toBeNull();
    expect(inviteEmailProblem("sam.kerr@northbank")).toBe("Not an email address");
    expect(normaliseInviteEmail("  Sam@Northbank.Gallery ")).toBe("sam@northbank.gallery");
  });

  it("says why a batch can't be sent", () => {
    expect(inviteBatchProblem([])).toBe("Add at least one email address.");
    expect(inviteBatchProblem(["a@x.com", "oops"])).toBe("Check oops: it isn't an email address.");
    expect(inviteBatchProblem(["a", "b"])).toBe(
      "2 entries aren't email addresses. Fix or remove them.",
    );
    const many = Array.from({ length: MAX_INVITES_AT_ONCE + 1 }, (_, i) => `p${i}@x.com`);
    expect(inviteBatchProblem(many)).toBe("Invite up to 20 people at a time.");
    expect(inviteBatchProblem(["a@x.com"])).toBeNull();
  });

  it("counts the button", () => {
    expect(sendInvitesLabel(1)).toBe("Send invitation");
    expect(sendInvitesLabel(3)).toBe("Send 3 invitations");
  });

  it("keeps refused addresses with their reason and toasts what went out", () => {
    const summary = summariseInviteBatch(
      [
        { email: "a@x.com", ok: true },
        { email: "b@x.com", ok: false, error: "This person is already a member." },
        { email: "c@x.com", ok: true },
      ],
      "Northbank Gallery",
    );
    expect(summary.sentTitle).toBe("2 invitations sent to join Northbank Gallery");
    expect(summary.failed).toEqual([
      { email: "b@x.com", error: "This person is already a member." },
    ]);
    expect(summariseInviteBatch([{ email: "a@x.com", ok: false, error: "No" }], "N").sentTitle).toBe(
      null,
    );
  });
});
