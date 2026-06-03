import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";

function productionEnvBase(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: "production",
    APP_ENV: "production",
    DATABASE_URL: "postgres://localhost/db",
    BETTER_AUTH_SECRET: "x".repeat(48),
    WEB_ORIGIN: "https://app.example.com",
    API_PUBLIC_URL: "https://api.example.com",
    AUTH_DEK_KEY: "a".repeat(64),
    CRON_INTERNAL_SECRET: "c".repeat(32),
    OPS_SUPPORT_EMAIL: "support@example.com",
    OPS_ONCALL_EMAIL: "oncall@example.com",
    POSTMARK_WEBHOOK_BASIC_AUTH: "basic-auth",
    BREVO_WEBHOOK_SECRET: "brevo-webhook-secret",
    STRIPE_SECRET_KEY: "sk_live_test_key",
    STRIPE_PUBLISHABLE_KEY: "pk_live_test_key",
    STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect",
    STRIPE_TRANSFERS_WEBHOOK_SECRET: "whsec_transfers",
    STRIPE_PAYMENTS_WEBHOOK_SECRET: "whsec_payments",
    VERIFF_API_KEY: "veriff-api-key",
    VERIFF_SHARED_SECRET: "veriff-shared-secret",
    ...overrides,
  };
}

describe("envSchema production Veriff validation", () => {
  it("accepts production env when Veriff credentials are present", () => {
    const parsed = envSchema.safeParse(productionEnvBase());
    expect(parsed.success).toBe(true);
  });

  it("rejects production env when VERIFF_API_KEY is missing", () => {
    const parsed = envSchema.safeParse(productionEnvBase({ VERIFF_API_KEY: undefined }));
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.flatten().fieldErrors.VERIFF_API_KEY).toContain(
      "VERIFF_API_KEY is required in production",
    );
  });

  it("rejects production env when VERIFF_SHARED_SECRET is missing", () => {
    const parsed = envSchema.safeParse(productionEnvBase({ VERIFF_SHARED_SECRET: undefined }));
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.flatten().fieldErrors.VERIFF_SHARED_SECRET).toContain(
      "VERIFF_SHARED_SECRET is required in production",
    );
  });
});
