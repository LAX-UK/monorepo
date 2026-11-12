import { describe, expect, it } from "vitest";
import { envSchema, resolveStrictBidEligibilityEnabled } from "./env.js";

function productionEnvBase(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: "production",
    APP_ENV: "production",
    DATABASE_URL: "postgres://localhost/db",
    CHECK_IN_TOKEN_SECRET: "x".repeat(48),
    WEB_ORIGIN: "https://app.example.com",
    API_PUBLIC_URL: "https://api.example.com",
    OIDC_ISSUER_URL: "https://identity.example.com",
    IDENTITY_MACHINE_CLIENT_ID: "api-service",
    IDENTITY_MACHINE_CLIENT_SECRET: "identity-machine-secret-at-least-32-characters",
    CRON_INTERNAL_SECRET: "c".repeat(32),
    ALERT_LINK_SECRET: "a".repeat(40),
    OPS_SUPPORT_EMAIL: "support@example.com",
    OPS_ONCALL_EMAIL: "oncall@example.com",
    POSTMARK_WEBHOOK_BASIC_AUTH: "basic-auth",
    STRIPE_SECRET_KEY: "sk_live_test_key",
    STRIPE_PUBLISHABLE_KEY: "pk_live_test_key",
    STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect",
    STRIPE_TRANSFERS_WEBHOOK_SECRET: "whsec_transfers",
    STRIPE_PAYMENTS_WEBHOOK_SECRET: "whsec_payments",
    VERIFF_API_KEY: "veriff-api-key",
    VERIFF_SHARED_SECRET: "veriff-shared-secret",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    VERIFY_ORIGIN: "true",
    ...overrides,
  };
}

describe("envSchema WEB_ORIGINS", () => {
  it("falls back to CORS_ALLOWED_ORIGINS when WEB_ORIGINS is unset", () => {
    const prev = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS = "https://lax.bid,https://event.lax.bid";
    try {
      const parsed = envSchema.safeParse(productionEnvBase());
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      expect(parsed.data.WEB_ORIGINS).toEqual(["https://lax.bid", "https://event.lax.bid"]);
    } finally {
      process.env.CORS_ALLOWED_ORIGINS = prev ?? "";
    }
  });
});

describe("envSchema identity audience migration", () => {
  it("defaults to the Bid resource and disables legacy lax-api", () => {
    const parsed = envSchema.safeParse(productionEnvBase());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.JWT_AUDIENCE).toBe("lax-bid-api");
    expect(parsed.data.ALLOW_LEGACY_LAX_API_AUDIENCE).toBe(false);
  });

  it("requires an explicit compatibility flag to enable legacy acceptance", () => {
    const parsed = envSchema.safeParse(
      productionEnvBase({ ALLOW_LEGACY_LAX_API_AUDIENCE: "true" }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.ALLOW_LEGACY_LAX_API_AUDIENCE).toBe(true);
  });
});

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

  it("rejects production env when TURNSTILE_SECRET_KEY is missing", () => {
    const parsed = envSchema.safeParse(productionEnvBase({ TURNSTILE_SECRET_KEY: undefined }));
    expect(parsed.success).toBe(false);
  });

  it("rejects production env when VERIFY_ORIGIN is false", () => {
    const parsed = envSchema.safeParse(productionEnvBase({ VERIFY_ORIGIN: "false" }));
    expect(parsed.success).toBe(false);
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

describe("strict bid eligibility rollout", () => {
  it("defaults off in production and on elsewhere", () => {
    expect(resolveStrictBidEligibilityEnabled({ APP_ENV: "production" })).toBe(false);
    expect(resolveStrictBidEligibilityEnabled({ APP_ENV: "test" })).toBe(true);
    expect(resolveStrictBidEligibilityEnabled({ APP_ENV: "development" })).toBe(true);
  });

  it("honours an explicit value", () => {
    expect(
      resolveStrictBidEligibilityEnabled({
        APP_ENV: "production",
        STRICT_BID_ELIGIBILITY_ENABLED: true,
      }),
    ).toBe(true);
    expect(
      resolveStrictBidEligibilityEnabled({
        APP_ENV: "development",
        STRICT_BID_ELIGIBILITY_ENABLED: false,
      }),
    ).toBe(false);
  });

  it.each(["1", "true", "yes", "on"])("parses %j as enabled at the HTTP env boundary", (value) => {
    const parsed = envSchema.safeParse(
      productionEnvBase({ STRICT_BID_ELIGIBILITY_ENABLED: value }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.STRICT_BID_ELIGIBILITY_ENABLED).toBe(true);
  });
});

describe("ATG sync flag", () => {
  it("is off by default, including in production", () => {
    const parsed = envSchema.safeParse(productionEnvBase());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.ATG_SYNC_ENABLED).toBe(false);
    expect(parsed.data.ATG_WHITE_LABEL_BASE_URL).toBeUndefined();
  });

  it("turns on only for an explicit true and treats an empty White Label URL as unset", () => {
    const parsed = envSchema.safeParse(
      productionEnvBase({ ATG_SYNC_ENABLED: "true", ATG_WHITE_LABEL_BASE_URL: "" }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.ATG_SYNC_ENABLED).toBe(true);
    expect(parsed.data.ATG_WHITE_LABEL_BASE_URL).toBeUndefined();
  });
});

describe("envSchema ALERT_LINK_SECRET in production", () => {
  it("refuses the development default", () => {
    const result = envSchema.safeParse(productionEnvBase({ ALERT_LINK_SECRET: undefined }));
    expect(result.success).toBe(false);
  });

  it("accepts a real secret", () => {
    expect(envSchema.safeParse(productionEnvBase()).success).toBe(true);
  });
});

describe("envSchema trusted proxies", () => {
  it("trusts the platform's private range by default and Cloudflare's published edges", () => {
    const parsed = envSchema.safeParse(productionEnvBase());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.API_TRUSTED_PROXY_CIDRS).toEqual(["10.0.0.0/8"]);
    expect(parsed.data.API_TRUSTED_CLOUDFLARE_PROXY_CIDRS).toContain("173.245.48.0/20");
    expect(parsed.data.API_SSR_CLIENT_IP_TOKEN).toBeUndefined();
  });

  it("reads a comma-separated override", () => {
    const parsed = envSchema.safeParse(
      productionEnvBase({ API_TRUSTED_PROXY_CIDRS: "10.0.0.0/8, 172.16.0.0/12" }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.API_TRUSTED_PROXY_CIDRS).toEqual(["10.0.0.0/8", "172.16.0.0/12"]);
  });
});

describe("envSchema PRIVATE_SALE_RECORD_RETENTION_YEARS", () => {
  const years = (value: unknown) =>
    envSchema.safeParse(productionEnvBase({ PRIVATE_SALE_RECORD_RETENTION_YEARS: value }));

  it("refuses less than the five years the money laundering rules require", () => {
    expect(years("4").success).toBe(false);
  });

  it("accepts five or more, and defaults to five", () => {
    expect(years("5").success).toBe(true);
    expect(years("10").success).toBe(true);
    const parsed = years("");
    expect(parsed.success && parsed.data.PRIVATE_SALE_RECORD_RETENTION_YEARS).toBe(5);
  });
});

describe("envSchema private sale deadlines", () => {
  const parse = (extra: Record<string, unknown> = {}) =>
    envSchema.safeParse(productionEnvBase(extra));

  it("suggests 7 days to pay and 14 to collect until the owner decides", () => {
    const parsed = parse();
    expect(parsed.success && parsed.data.PRIVATE_SALE_PAYMENT_DUE_DAYS).toBe(7);
    expect(parsed.success && parsed.data.PRIVATE_SALE_COLLECTION_DUE_DAYS).toBe(14);
    const blank = parse({
      PRIVATE_SALE_PAYMENT_DUE_DAYS: "",
      PRIVATE_SALE_COLLECTION_DUE_DAYS: "",
    });
    expect(blank.success && blank.data.PRIVATE_SALE_PAYMENT_DUE_DAYS).toBe(7);
    expect(blank.success && blank.data.PRIVATE_SALE_COLLECTION_DUE_DAYS).toBe(14);
  });

  it("takes the owner's answer when it is set, and refuses nonsense", () => {
    const set = parse({
      PRIVATE_SALE_PAYMENT_DUE_DAYS: "10",
      PRIVATE_SALE_COLLECTION_DUE_DAYS: "21",
    });
    expect(set.success && set.data.PRIVATE_SALE_PAYMENT_DUE_DAYS).toBe(10);
    expect(set.success && set.data.PRIVATE_SALE_COLLECTION_DUE_DAYS).toBe(21);
    expect(parse({ PRIVATE_SALE_PAYMENT_DUE_DAYS: "0" }).success).toBe(false);
    expect(parse({ PRIVATE_SALE_COLLECTION_DUE_DAYS: "400" }).success).toBe(false);
  });
});

describe("api XERO_TOKEN_DEK_KEY", () => {
  const issues = (overrides: Record<string, unknown>) => {
    const result = envSchema.safeParse(productionEnvBase(overrides));
    return result.success
      ? []
      : result.error.issues.filter((i) => i.path[0] === "XERO_TOKEN_DEK_KEY");
  };
  const xero = {
    XERO_CLIENT_ID: "id",
    XERO_CLIENT_SECRET: "secret",
    XERO_REDIRECT_URI: "https://app.example.com/cb",
    XERO_WEBHOOK_KEY: "hook",
  };

  it("is required once Xero is configured, and must be a 32-byte key", () => {
    expect(issues(xero)).not.toHaveLength(0);
    expect(issues({ ...xero, XERO_TOKEN_DEK_KEY: "short" })).not.toHaveLength(0);
    expect(issues({ ...xero, XERO_TOKEN_DEK_KEY: "ab".repeat(32) })).toEqual([]);
  });

  it("is not needed when Xero is not configured", () => {
    expect(issues({})).toEqual([]);
  });
});
