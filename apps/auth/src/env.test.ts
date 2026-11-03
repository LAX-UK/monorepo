import { describe, expect, it } from "vitest";
import {
  deriveLaxArtOriginFromShopOrigin,
  deriveShopAdminOriginFromShopOrigin,
  parseAuthEnv,
} from "./env.js";

const base = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://localhost/auction",
  BETTER_AUTH_SECRET: "development-secret",
};
const production = {
  ...base,
  NODE_ENV: "production",
  APP_ENV: "production",
  BETTER_AUTH_SECRET: "x".repeat(48),
  AUTH_DEK_KEY: "00".repeat(32),
  IDENTITY_MACHINE_CLIENT_ID: "identity-machine",
  IDENTITY_MACHINE_CLIENT_SECRET: "m".repeat(32),
  OIDC_ISSUER_URL: "https://auth.example.com",
  WEB_ORIGIN: "https://example.com",
  SHOP_ORIGIN: "https://shop.example.com",
  API_INTERNAL_BASE_URL: "https://api.internal.example.com",
};

describe("auth app environment contract", () => {
  it("parses issuer and origin passthrough consistently", () => {
    const env = parseAuthEnv({
      ...base,
      OIDC_ISSUER_URL: "https://auth.example.com",
      WEB_ORIGIN: "https://example.com",
      WEB_ORIGINS: "https://example.com,https://event.example.com",
      SSR_TRUSTED_ORIGINS: "https://internal.example.com",
      AUTH_TRUSTED_PROXY_CIDRS: "10.0.0.0/8,2001:db8::/32",
      AUTH_TRUSTED_CLOUDFLARE_PROXY_CIDRS: "173.245.48.0/20,2400:cb00::/32",
      AUTH_CLIENT_IP_DIAGNOSTICS: "true",
      JWT_AUDIENCE: "example-api",
      API_INTERNAL_BASE_URL: "https://api.internal.example.com",
      IDENTITY_EMAIL_ENQUEUE_TIMEOUT_MS: "2500",
      IDENTITY_SUBJECT_USAGE_TIMEOUT_MS: "1250",
    });
    expect(env.WEB_ORIGINS).toEqual(["https://example.com", "https://event.example.com"]);
    expect(env.SSR_TRUSTED_ORIGINS).toEqual(["https://internal.example.com"]);
    expect(env.AUTH_TRUSTED_PROXY_CIDRS).toEqual(["10.0.0.0/8", "2001:db8::/32"]);
    expect(env.AUTH_TRUSTED_CLOUDFLARE_PROXY_CIDRS).toEqual(["173.245.48.0/20", "2400:cb00::/32"]);
    expect(env.AUTH_CLIENT_IP_DIAGNOSTICS).toBe(true);
    expect(env.JWT_AUDIENCE).toBe("example-api");
    expect(env.API_INTERNAL_BASE_URL).toBe("https://api.internal.example.com");
    expect(env.IDENTITY_EMAIL_ENQUEUE_TIMEOUT_MS).toBe(2500);
    expect(env.IDENTITY_SUBJECT_USAGE_TIMEOUT_MS).toBe(1250);
    expect(env.HOSTED_AUTH_EMAIL_FIRST).toBe(true);
  });

  it("allows disabling email-first hosted sign-in", () => {
    const env = parseAuthEnv({ ...base, HOSTED_AUTH_EMAIL_FIRST: "false" });
    expect(env.HOSTED_AUTH_EMAIL_FIRST).toBe(false);
  });

  it("rejects insecure production cookies and missing envelope encryption", () => {
    expect(() =>
      parseAuthEnv({
        ...base,
        NODE_ENV: "production",
        APP_ENV: "production",
        BETTER_AUTH_SECRET: "x".repeat(48),
        OIDC_ISSUER_URL: "https://auth.example.com",
        WEB_ORIGIN: "https://example.com",
        ALLOW_HTTP_COOKIES: "true",
      }),
    ).toThrow("Invalid auth app environment variables");
  });

  it.each([
    ["OIDC_ISSUER_URL", "http://auth.example.com"],
    ["WEB_ORIGIN", "http://example.com"],
    ["SHOP_ORIGIN", "http://shop.example.com"],
    ["WEB_ORIGINS", "https://example.com,http://shop.example.com"],
    ["SSR_TRUSTED_ORIGINS", "http://web.internal.example.com"],
  ])("rejects a non-HTTPS production %s", (field, value) => {
    expect(() => parseAuthEnv({ ...production, [field]: value })).toThrow(
      "Invalid auth app environment variables",
    );
  });

  it("reports SHOP_ORIGIN when production env omits it", () => {
    const { SHOP_ORIGIN: _shopOrigin, ...withoutShopOrigin } = production;
    expect(() => parseAuthEnv(withoutShopOrigin)).toThrow(/SHOP_ORIGIN/);
  });

  it("derives SHOP_ADMIN_ORIGIN from test SHOP_ORIGIN when unset", () => {
    const env = parseAuthEnv({
      ...production,
      SHOP_ORIGIN: "https://test-shop.lax.bid",
    });
    expect(env.SHOP_ADMIN_ORIGIN).toBe("https://test-shop-admin.lax.bid");
    expect(env.LAX_ART_ORIGIN).toBe("https://test-art.lax.bid");
  });

  it("maps known shop hosts to shop-admin origins", () => {
    expect(deriveShopAdminOriginFromShopOrigin("https://test-shop.lax.bid")).toBe(
      "https://test-shop-admin.lax.bid",
    );
    expect(deriveShopAdminOriginFromShopOrigin("https://shop.lax.bid")).toBe(
      "https://shop-admin.lax.bid",
    );
    expect(deriveLaxArtOriginFromShopOrigin("https://test-shop.lax.bid")).toBe(
      "https://test-art.lax.bid",
    );
    expect(deriveLaxArtOriginFromShopOrigin("https://shop.lax.art")).toBe("https://www.thelax.art");
  });
});

describe("data download environment", () => {
  const exportBucket = {
    SUBJECT_EXPORT_BUCKET: "lax-personal-exports",
    SUBJECT_EXPORT_REGION: "lon1",
    SUBJECT_EXPORT_READ_ACCESS_KEY_ID: "read-key",
    SUBJECT_EXPORT_READ_SECRET_ACCESS_KEY: "read-secret",
  };

  it("needs none of it: requests work and the progress route is simply not mounted", () => {
    const env = parseAuthEnv(base);
    expect(env.SUBJECT_EXPORT_BUCKET).toBeUndefined();
    expect(env.SUBJECT_EXPORT_MACHINE_CLIENT_ID).toBeUndefined();
  });

  it("accepts a complete bucket and a complete machine credential", () => {
    const env = parseAuthEnv({
      ...base,
      ...exportBucket,
      SUBJECT_EXPORT_ENDPOINT: "https://lon1.digitaloceanspaces.com",
      SUBJECT_EXPORT_MACHINE_CLIENT_ID: "subject-export-worker",
      SUBJECT_EXPORT_MACHINE_CLIENT_SECRET: "s".repeat(32),
    });
    expect(env.SUBJECT_EXPORT_BUCKET).toBe("lax-personal-exports");
    expect(env.SUBJECT_EXPORT_MACHINE_CLIENT_ID).toBe("subject-export-worker");
  });

  it("rejects half a bucket configuration", () => {
    expect(() => parseAuthEnv({ ...base, SUBJECT_EXPORT_BUCKET: "lax-personal-exports" })).toThrow(
      /must be set together/,
    );
  });

  it("rejects half a machine credential, and one that reuses the lifecycle client", () => {
    expect(() =>
      parseAuthEnv({ ...base, SUBJECT_EXPORT_MACHINE_CLIENT_ID: "subject-export-worker" }),
    ).toThrow(/must be set together/);
    expect(() =>
      parseAuthEnv({
        ...production,
        SUBJECT_EXPORT_MACHINE_CLIENT_ID: "identity-machine",
        SUBJECT_EXPORT_MACHINE_CLIENT_SECRET: "s".repeat(32),
      }),
    ).toThrow(/must differ from IDENTITY_MACHINE_CLIENT_ID/);
  });
});

describe("data requests environment", () => {
  it("is optional and retains contact details for two years by default", () => {
    const env = parseAuthEnv(base);
    expect(env.DATA_REQUESTS_MACHINE_CLIENT_ID).toBeUndefined();
    expect(env.DATA_REQUEST_CONTACT_RETENTION_DAYS).toBe(730);
  });

  it("accepts a complete credential and a configured retention period", () => {
    const env = parseAuthEnv({
      ...base,
      DATA_REQUESTS_MACHINE_CLIENT_ID: "bid-data-requests",
      DATA_REQUESTS_MACHINE_CLIENT_SECRET: "d".repeat(32),
      DATA_REQUEST_CONTACT_RETENTION_DAYS: "365",
    });
    expect(env.DATA_REQUESTS_MACHINE_CLIENT_ID).toBe("bid-data-requests");
    expect(env.DATA_REQUEST_CONTACT_RETENTION_DAYS).toBe(365);
  });

  it("rejects half a credential and one that reuses another client", () => {
    expect(() =>
      parseAuthEnv({ ...base, DATA_REQUESTS_MACHINE_CLIENT_ID: "bid-data-requests" }),
    ).toThrow(/must be set together/);
    for (const [variable, id] of [
      ["IDENTITY_MACHINE_CLIENT_ID", "identity-machine"],
      ["SUBJECT_EXPORT_MACHINE_CLIENT_ID", "subject-export-worker"],
    ] as const) {
      expect(() =>
        parseAuthEnv({
          ...base,
          [variable]: id,
          ...(variable === "SUBJECT_EXPORT_MACHINE_CLIENT_ID"
            ? { SUBJECT_EXPORT_MACHINE_CLIENT_SECRET: "s".repeat(32) }
            : { IDENTITY_MACHINE_CLIENT_SECRET: "m".repeat(32) }),
          DATA_REQUESTS_MACHINE_CLIENT_ID: id,
          DATA_REQUESTS_MACHINE_CLIENT_SECRET: "d".repeat(32),
        }),
      ).toThrow(/must differ/);
    }
  });
});
