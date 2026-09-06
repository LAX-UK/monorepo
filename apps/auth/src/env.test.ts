import { describe, expect, it } from "vitest";
import { parseAuthEnv } from "./env.js";

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
      JWT_AUDIENCE: "example-api",
      API_INTERNAL_BASE_URL: "https://api.internal.example.com",
      IDENTITY_EMAIL_ENQUEUE_TIMEOUT_MS: "2500",
      IDENTITY_SUBJECT_USAGE_TIMEOUT_MS: "1250",
    });
    expect(env.WEB_ORIGINS).toEqual(["https://example.com", "https://event.example.com"]);
    expect(env.SSR_TRUSTED_ORIGINS).toEqual(["https://internal.example.com"]);
    expect(env.AUTH_TRUSTED_PROXY_CIDRS).toEqual(["10.0.0.0/8", "2001:db8::/32"]);
    expect(env.JWT_AUDIENCE).toBe("example-api");
    expect(env.API_INTERNAL_BASE_URL).toBe("https://api.internal.example.com");
    expect(env.IDENTITY_EMAIL_ENQUEUE_TIMEOUT_MS).toBe(2500);
    expect(env.IDENTITY_SUBJECT_USAGE_TIMEOUT_MS).toBe(1250);
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
    ["WEB_ORIGINS", "https://example.com,http://shop.example.com"],
    ["SSR_TRUSTED_ORIGINS", "http://web.internal.example.com"],
  ])("rejects a non-HTTPS production %s", (field, value) => {
    expect(() => parseAuthEnv({ ...production, [field]: value })).toThrow(
      "Invalid auth app environment variables",
    );
  });
});
