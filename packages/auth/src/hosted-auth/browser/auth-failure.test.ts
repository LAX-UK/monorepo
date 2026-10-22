import { describe, expect, it } from "vitest";
import {
  type AuthFailureContext,
  type FailedResponse,
  describeAuthFailure,
  isTransientFailure,
  rateLimitedMessage,
  retryAfterSeconds,
} from "./auth-failure.js";

const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

function describe_(
  response: Partial<FailedResponse> & { status: number },
  context: AuthFailureContext = "other",
  fallback = "fallback",
) {
  return describeAuthFailure({ data: null, ...response }, context, fallback, NOW);
}

describe("retryAfterSeconds", () => {
  it("reads whole seconds from Retry-After", () => {
    expect(retryAfterSeconds({ status: 429, data: null, retryAfter: "120" }, NOW)).toBe(120);
  });

  it("reads an HTTP date from Retry-After", () => {
    const later = new Date(NOW + 90_000).toUTCString();
    expect(retryAfterSeconds({ status: 429, data: null, retryAfter: later }, NOW)).toBe(90);
  });

  it("reads a reset header given as seconds or as a Unix timestamp", () => {
    expect(retryAfterSeconds({ status: 429, data: null, rateLimitReset: "45" }, NOW)).toBe(45);
    const epoch = String(Math.floor(NOW / 1000) + 300);
    expect(retryAfterSeconds({ status: 429, data: null, rateLimitReset: epoch }, NOW)).toBe(300);
  });

  it("falls back to the retryAfterSec the auth server puts in the body", () => {
    expect(retryAfterSeconds({ status: 429, data: { retryAfterSec: 600 } }, NOW)).toBe(600);
  });

  it("ignores values that are missing, past or malformed", () => {
    expect(retryAfterSeconds({ status: 429, data: null }, NOW)).toBeNull();
    expect(retryAfterSeconds({ status: 429, data: null, retryAfter: "soon" }, NOW)).toBeNull();
    expect(retryAfterSeconds({ status: 429, data: null, retryAfter: "0" }, NOW)).toBeNull();
  });
});

describe("rateLimitedMessage", () => {
  it.each([
    [1, "Too many attempts. Try again in 1 minute."],
    [60, "Too many attempts. Try again in 1 minute."],
    [61, "Too many attempts. Try again in 2 minutes."],
    [1800, "Too many attempts. Try again in 30 minutes."],
    [null, "Too many attempts. Try again in a few minutes."],
  ])("for %s seconds says %s", (seconds, expected) => {
    expect(rateLimitedMessage(seconds)).toBe(expected);
  });
});

describe("describeAuthFailure", () => {
  it.each<AuthFailureContext>(["sign-in", "two-factor", "other"])(
    "reports throttling the same way on %s",
    (context) => {
      expect(describe_({ status: 429, retryAfter: "300" }, context).message).toBe(
        "Too many attempts. Try again in 5 minutes.",
      );
    },
  );

  it.each([500, 502, 503])("blames our side for a %s, never the user's input", (status) => {
    expect(describe_({ status }, "sign-in").message).toBe(
      "Something went wrong on our side. Try again.",
    );
    expect(describe_({ status }, "two-factor").message).toBe(
      "Something went wrong on our side. Try again.",
    );
  });

  describe("sign-in", () => {
    it("keeps the generic message for a wrong password so accounts are not revealed", () => {
      expect(describe_({ status: 401 }, "sign-in").message).toBe("Invalid email or password.");
      expect(describe_({ status: 400 }, "sign-in").message).toBe("Invalid email or password.");
    });

    it("offers to resend the verification email for an unverified address", () => {
      expect(describe_({ status: 403, data: { code: "EMAIL_NOT_VERIFIED" } }, "sign-in")).toEqual({
        message: "Verify your email to continue.",
        action: "resend-verification",
      });
    });

    it("does not offer a resend for other forbidden responses", () => {
      expect(describe_({ status: 403, data: { code: "BANNED_USER" } }, "sign-in")).toEqual({
        message: "fallback",
      });
    });
  });

  describe("two-factor challenge", () => {
    it("tells the user the sign-in timed out when the challenge cookie is gone", () => {
      expect(
        describe_({ status: 401, data: { code: "INVALID_TWO_FACTOR_COOKIE" } }, "two-factor"),
      ).toEqual({ message: "Your sign-in timed out.", action: "start-again" });
    });

    it("treats a wrong code as a wrong code, not a timeout", () => {
      expect(describe_({ status: 401, data: { code: "INVALID_CODE" } }, "two-factor")).toEqual({
        message: "That code didn't match. Check your authenticator app and try again.",
      });
    });

    it("explains a wrong backup code", () => {
      expect(
        describe_({ status: 401, data: { code: "INVALID_BACKUP_CODE" } }, "two-factor").message,
      ).toContain("backup code didn't work");
    });

    it("explains Better Auth's per-factor lockout rather than a generic rate limit", () => {
      expect(
        describe_({ status: 429, data: { code: "ACCOUNT_TEMPORARILY_LOCKED" } }, "two-factor")
          .message,
      ).toContain("locked for a short while");
    });
  });

  it("uses the caller's fallback for an unclassified client error", () => {
    expect(describe_({ status: 422 }, "other", "Reset link is invalid or expired.").message).toBe(
      "Reset link is invalid or expired.",
    );
  });
});

describe("isTransientFailure", () => {
  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
    [403, false],
  ])("%s -> %s", (status, expected) => {
    expect(isTransientFailure(status)).toBe(expected);
  });
});

/**
 * Each hosted entry script reports failures through `reportFailure` with one of these
 * (context, fallback) pairs; this pins what the user sees for the cases the screens share.
 */
describe("per-screen outcomes", () => {
  const screens: Array<[string, AuthFailureContext, string]> = [
    ["login", "sign-in", "Invalid email or password."],
    ["magic-link", "other", "Something went wrong. Try again."],
    ["forgot-password", "other", "Something went wrong. Try again."],
    ["resend-verification", "other", "Something went wrong. Try again."],
    ["sign-up", "other", "Unable to create your account. Try again later."],
    ["reset-password", "other", "Unable to reset password. Request a new link."],
    ["two-factor", "two-factor", "Verification failed. Try again."],
  ];

  it.each(screens)("%s shows the throttling message on a 429", (_screen, context, fallback) => {
    expect(describe_({ status: 429, retryAfter: "900" }, context, fallback).message).toBe(
      "Too many attempts. Try again in 15 minutes.",
    );
  });

  it.each(screens)("%s shows the server-fault message on a 503", (_screen, context, fallback) => {
    expect(describe_({ status: 503 }, context, fallback).message).toBe(
      "Something went wrong on our side. Try again.",
    );
  });
});
