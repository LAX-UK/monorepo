import { notificationPreference } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "./email-unsubscribe-token.js";
import { emailPreferenceKey, notificationTypeToTemplate } from "./notification-preference-keys.js";

const secret = "test-unsubscribe-secret-long-enough";

describe("email unsubscribe identifiers", () => {
  for (const notificationType of ["outbid", "lot_won", "lot_ended_seller"] as const) {
    it(`round-trips ${notificationType}`, () => {
      const token = createUnsubscribeToken(
        { scope: "type", userId: "user_1", notificationType },
        secret,
      );
      expect(verifyUnsubscribeToken(token, secret)).toEqual({
        scope: "type",
        userId: "user_1",
        notificationType,
      });

      const preferenceKey = emailPreferenceKey(notificationType);
      expect(preferenceKey).toBeTruthy();
      expect(preferenceKey && preferenceKey in notificationPreference).toBe(true);
      expect(notificationTypeToTemplate(notificationType)).toMatch(/-/);
    });
  }

  it("rejects tampered tokens", () => {
    const token = createUnsubscribeToken({ scope: "global", userId: "user_1" }, secret);
    expect(() => verifyUnsubscribeToken(`${token}x`, secret)).toThrow();
  });
});
