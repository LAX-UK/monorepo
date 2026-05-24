import { describe, expect, it } from "vitest";
import { buildVeriffCreateSessionVerification } from "./veriff-session-payload.js";

const CALLBACK = "https://test.lax.bid/dashboard/verify-identity?kyc=complete";

describe("buildVeriffCreateSessionVerification", () => {
  it("sends vendorData only for Better Auth alphanumeric user ids", () => {
    const userId = "kX9mP2nQ7rS4tU6vW8xY0zA1bC3dE5fG";
    expect(buildVeriffCreateSessionVerification({ userId, callbackUrl: CALLBACK })).toEqual({
      callback: CALLBACK,
      vendorData: userId,
    });
  });

  it("includes endUserId when user id is UUID v4", () => {
    const userId = "c1de400b-1877-4284-8494-071d37916197";
    expect(buildVeriffCreateSessionVerification({ userId, callbackUrl: CALLBACK })).toEqual({
      callback: CALLBACK,
      vendorData: userId,
      endUserId: userId,
    });
  });

  it("omits endUserId for non-v4 UUID-shaped ids", () => {
    const userId = "c1de400b-1877-1284-8494-071d37916197";
    expect(buildVeriffCreateSessionVerification({ userId, callbackUrl: CALLBACK })).toEqual({
      callback: CALLBACK,
      vendorData: userId,
    });
  });

  it("trims whitespace from user id before validation", () => {
    const userId = "  c1de400b-1877-4284-8494-071d37916197  ";
    expect(buildVeriffCreateSessionVerification({ userId, callbackUrl: CALLBACK })).toEqual({
      callback: CALLBACK,
      vendorData: "c1de400b-1877-4284-8494-071d37916197",
      endUserId: "c1de400b-1877-4284-8494-071d37916197",
    });
  });
});
