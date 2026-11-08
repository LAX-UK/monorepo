import { describe, expect, it } from "vitest";
import {
  SOCIAL_PROVIDER_IDS,
  decideImplicitLink,
  isSocialProviderId,
  mayUseSocialSignIn,
} from "./social-sign-in-policy.js";

const ORDINARY = { isStaff: false, twoFactorEnabled: false, emailVerified: true };

describe("decideImplicitLink", () => {
  it.each([
    ["an ordinary account with a confirmed email", ORDINARY, { kind: "link" }],
    [
      "an account whose email was never confirmed (SM5)",
      { ...ORDINARY, emailVerified: false },
      { kind: "link_and_secure" },
    ],
    [
      "an account with two-step verification on",
      { ...ORDINARY, twoFactorEnabled: true },
      { kind: "block", reason: "two_step" },
    ],
    ["a staff account", { ...ORDINARY, isStaff: true }, { kind: "block", reason: "staff" }],
    [
      "a staff account that also has two-step on: staff is the reason given",
      { ...ORDINARY, isStaff: true, twoFactorEnabled: true },
      { kind: "block", reason: "staff" },
    ],
    [
      "an unconfirmed account with two-step on is blocked, never secured",
      { ...ORDINARY, emailVerified: false, twoFactorEnabled: true },
      { kind: "block", reason: "two_step" },
    ],
    [
      "an unconfirmed staff account is blocked, never secured",
      { ...ORDINARY, emailVerified: false, isStaff: true },
      { kind: "block", reason: "staff" },
    ],
  ])("for %s", (_name, subject, expected) => {
    expect(decideImplicitLink(subject)).toEqual(expected);
  });
});

describe("mayUseSocialSignIn", () => {
  it("is for everyone but staff", () => {
    expect(mayUseSocialSignIn({ isStaff: false })).toBe(true);
    expect(mayUseSocialSignIn({ isStaff: true })).toBe(false);
  });
});

describe("isSocialProviderId", () => {
  it("knows Google and Apple only", () => {
    expect([...SOCIAL_PROVIDER_IDS]).toEqual(["google", "apple"]);
    expect(isSocialProviderId("google")).toBe(true);
    expect(isSocialProviderId("apple")).toBe(true);
    expect(isSocialProviderId("credential")).toBe(false);
    expect(isSocialProviderId("github")).toBe(false);
  });
});
