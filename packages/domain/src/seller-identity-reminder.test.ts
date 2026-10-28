import { describe, expect, it } from "vitest";
import {
  SELLER_IDENTITY_REMINDER_INTERVAL_MS,
  decideSellerIdentityReminder,
  sellerIdentityReminderState,
} from "./seller-identity-reminder.js";

const now = new Date("2026-10-28T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

describe("decideSellerIdentityReminder", () => {
  const base = {
    submissionStatus: "under_review" as const,
    identityVerified: false,
    lastSentAt: null,
    now,
  };

  it("sends the first reminder", () => {
    expect(decideSellerIdentityReminder(base)).toEqual({ kind: "send" });
  });

  it("sends nothing again inside a day", () => {
    const lastSentAt = hoursAgo(23);
    expect(decideSellerIdentityReminder({ ...base, lastSentAt })).toEqual({
      kind: "already_sent",
      lastSentAt,
      nextAllowedAt: new Date(lastSentAt.getTime() + SELLER_IDENTITY_REMINDER_INTERVAL_MS),
    });
  });

  it("sends again once a day has passed", () => {
    expect(decideSellerIdentityReminder({ ...base, lastSentAt: hoursAgo(24) })).toEqual({
      kind: "send",
    });
  });

  it("is not needed once the identity is verified", () => {
    expect(decideSellerIdentityReminder({ ...base, identityVerified: true })).toEqual({
      kind: "not_needed",
      reason: "identity_verified",
    });
  });

  it.each(["submitted", "approved", "converted", "rejected"] as const)(
    "is not needed for a %s submission",
    (submissionStatus) => {
      expect(decideSellerIdentityReminder({ ...base, submissionStatus })).toEqual({
        kind: "not_needed",
        reason: "not_under_review",
      });
    },
  );
});

describe("sellerIdentityReminderState", () => {
  it("has no times before the first reminder", () => {
    expect(sellerIdentityReminderState(null)).toEqual({ lastSentAt: null, nextAllowedAt: null });
  });

  it("allows the next one a day after the last", () => {
    const last = hoursAgo(2);
    expect(sellerIdentityReminderState(last).nextAllowedAt).toEqual(
      new Date(last.getTime() + SELLER_IDENTITY_REMINDER_INTERVAL_MS),
    );
  });
});
