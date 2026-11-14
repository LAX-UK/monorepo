import { describe, expect, it, vi } from "vitest";
import { createPaymentEligibilityGate, paymentsAreLive } from "./payment-eligibility.gate.js";

const personal = {
  findById: vi.fn(async () => ({ id: "le-1", kind: "individual", status: "approved" }) as never),
};
const input = { payerUserId: "user-1", buyerLegalEntityId: "le-1" };

describe("paymentsAreLive", () => {
  it.each([
    [{ NODE_ENV: "production" }, true],
    [{ NODE_ENV: "development", APP_ENV: "production" }, true],
    [{ NODE_ENV: "test", STRIPE_SECRET_KEY: "sk_live_fixture" }, true],
    [{ NODE_ENV: "development", STRIPE_SECRET_KEY: " sk_live_fixture " }, true],
    [
      { NODE_ENV: "development", APP_ENV: "development", STRIPE_SECRET_KEY: "sk_test_fixture" },
      false,
    ],
    [{ NODE_ENV: "test", APP_ENV: "test" }, false],
    [{}, false],
  ])("%j -> %s", (env, live) => {
    expect(paymentsAreLive(env)).toBe(live);
  });
});

describe("createPaymentEligibilityGate", () => {
  it.each([
    [
      "a production deployment whose NODE_ENV is not production",
      { NODE_ENV: "development", APP_ENV: "production" },
    ],
    [
      "a live Stripe key",
      { NODE_ENV: "test", APP_ENV: "test", STRIPE_SECRET_KEY: "sk_live_fixture" },
    ],
    ["a production build", { NODE_ENV: "production" }],
  ])(
    "holds an unverified personal payer when no identity provider is set, with %s",
    async (_label, env) => {
      const gate = createPaymentEligibilityGate({ accounts: personal, identity: null, env });
      await expect(gate.check(input)).resolves.toEqual({
        kind: "held",
        reason: "identity_verification_required",
      });
    },
  );

  it("does not ask for identity where no payments are taken and nobody can verify", async () => {
    const gate = createPaymentEligibilityGate({
      accounts: personal,
      identity: null,
      env: {
        NODE_ENV: "development",
        APP_ENV: "development",
        STRIPE_SECRET_KEY: "sk_test_fixture",
      },
    });
    await expect(gate.check(input)).resolves.toEqual({ kind: "payable" });
  });

  it("still asks the identity provider when one is set, whatever the deployment", async () => {
    const identity = {
      findBidActorEligibility: vi.fn(async () => ({
        emailVerified: true,
        kycStatus: "approved" as const,
      })),
    };
    const gate = createPaymentEligibilityGate({
      accounts: personal,
      identity,
      env: { APP_ENV: "production" },
    });
    await expect(gate.check(input)).resolves.toEqual({ kind: "payable" });
    expect(identity.findBidActorEligibility).toHaveBeenCalledWith("user-1");
  });
});
