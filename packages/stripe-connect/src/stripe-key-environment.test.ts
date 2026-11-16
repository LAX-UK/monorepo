import { describe, expect, it } from "vitest";
import { isStripeTestModeKey, stripeTestModeKeyIssues } from "./stripe-key-environment.js";

// Built from parts so no complete key-shaped string sits in the source.
const live = (prefix: string) => `${prefix}_live_${"x".repeat(16)}`;
const test = (prefix: string) => `${prefix}_test_${"x".repeat(16)}`;

describe("stripeTestModeKeyIssues", () => {
  it("refuses a live secret, publishable or restricted key when APP_ENV=test", () => {
    const issues = stripeTestModeKeyIssues("test", [
      { name: "STRIPE_SECRET_KEY", kind: "secret", value: live("sk") },
      { name: "STRIPE_PUBLISHABLE_KEY", kind: "publishable", value: live("pk") },
      { name: "STRIPE_BOOKS_READ_KEYS", kind: "restricted", value: live("rk") },
    ]);
    expect(issues.map((issue) => issue.name)).toEqual([
      "STRIPE_SECRET_KEY",
      "STRIPE_PUBLISHABLE_KEY",
      "STRIPE_BOOKS_READ_KEYS",
    ]);
    expect(issues[0]?.message).toBe(
      "STRIPE_SECRET_KEY in test must use a test key (sk_test_… or rk_test_…)",
    );
  });

  it("refuses a list when any one key in it is live", () => {
    expect(
      stripeTestModeKeyIssues("test", [
        {
          name: "STRIPE_BOOKS_READ_KEYS",
          kind: "restricted",
          value: `${test("rk")},${live("rk")}`,
        },
      ]),
    ).toHaveLength(1);
  });

  it("accepts test keys and unset keys on test", () => {
    expect(
      stripeTestModeKeyIssues("test", [
        { name: "STRIPE_SECRET_KEY", kind: "secret", value: test("sk") },
        { name: "STRIPE_PUBLISHABLE_KEY", kind: "publishable", value: test("pk") },
        {
          name: "STRIPE_BOOKS_READ_KEYS",
          kind: "restricted",
          value: `${test("rk")},${test("rk")}`,
        },
        { name: "STRIPE_WEBHOOK_SECRET", kind: "secret", value: undefined },
      ]),
    ).toEqual([]);
  });

  it("leaves other environments to their own checks", () => {
    for (const appEnv of ["production", "development", undefined]) {
      expect(
        stripeTestModeKeyIssues(appEnv, [
          { name: "STRIPE_SECRET_KEY", kind: "secret", value: live("sk") },
        ]),
      ).toEqual([]);
    }
  });
});

describe("isStripeTestModeKey", () => {
  it("does not take a live key of another kind for a test key", () => {
    expect(isStripeTestModeKey("publishable", test("sk"))).toBe(false);
    expect(isStripeTestModeKey("secret", live("sk"))).toBe(false);
    expect(isStripeTestModeKey("secret", test("rk"))).toBe(true);
  });
});
