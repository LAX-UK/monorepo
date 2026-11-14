import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { type Env, loadEnv } from "../env.js";
import {
  type CreatePaymentsServicesInput,
  createPaymentsServices,
} from "./create-payments-services.js";

/** Any property is a stub function that returns another stub, so constructors can be wired. */
function stub(): never {
  const fn = vi.fn(() => stub());
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === "then") return undefined;
      if (prop in target) return Reflect.get(target, prop);
      const value = stub();
      Reflect.set(target, prop, value);
      return value;
    },
  }) as never;
}

/** A local env as the API parses it (fixture values only), with the deployment fields set. */
function baseEnv(): Env {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("DATABASE_URL", "postgres://fixture@127.0.0.1:1/fixture");
  vi.stubEnv("CHECK_IN_TOKEN_SECRET", "fixture-check-in-secret-fixture-check-in-secret");
  vi.stubEnv("OIDC_ISSUER_URL", "https://auth.fixture");
  try {
    return loadEnv();
  } finally {
    vi.unstubAllEnvs();
  }
}

function build(env: Partial<Env>) {
  const input = {
    env: {
      ...baseEnv(),
      STRIPE_SECRET_KEY: "sk_test_fixture",
      STRIPE_PAYMENTS_WEBHOOK_SECRET: "whsec_fixture",
      ...env,
    },
    db: stub() as Database,
    infra: stub(),
    repos: stub(),
    platform: stub(),
    complianceMedia: {
      kycService: { isConfigured: () => false },
    },
    catalog: stub(),
  } as unknown as CreatePaymentsServicesInput;
  return createPaymentsServices(input);
}

describe("createPaymentsServices: the payment webhook's account check", () => {
  it.each([
    ["a production build", { NODE_ENV: "production", APP_ENV: "test" }, true],
    ["a production deployment", { NODE_ENV: "development", APP_ENV: "production" }, true],
    [
      "a live Stripe key",
      { NODE_ENV: "development", APP_ENV: "development", STRIPE_SECRET_KEY: "sk_live_fixture" },
      true,
    ],
    ["a local run", { NODE_ENV: "development", APP_ENV: "development" }, false],
  ] as const)("is required wherever payments are live: %s", (_label, env, required) => {
    const services = build(env as Partial<Env>);
    const webhook = services.stripePaymentWebhookService as unknown as {
      deps: { paymentEligibilityRequired: boolean };
    };
    expect(webhook).not.toBeNull();
    expect(webhook.deps.paymentEligibilityRequired).toBe(required);
  });
});
