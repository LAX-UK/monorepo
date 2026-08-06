import { describe, expect, it } from "vitest";
import { parseAuthEnv } from "./env.js";

const base = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://localhost/auction",
  BETTER_AUTH_SECRET: "development-secret",
};

describe("auth app environment contract", () => {
  it("parses issuer and origin passthrough consistently", () => {
    const env = parseAuthEnv({
      ...base,
      OIDC_ISSUER_URL: "https://auth.example.com",
      WEB_ORIGIN: "https://example.com",
      WEB_ORIGINS: "https://example.com,https://event.example.com",
      SSR_TRUSTED_ORIGINS: "https://internal.example.com",
      JWT_AUDIENCE: "example-api",
    });
    expect(env.WEB_ORIGINS).toEqual(["https://example.com", "https://event.example.com"]);
    expect(env.SSR_TRUSTED_ORIGINS).toEqual(["https://internal.example.com"]);
    expect(env.JWT_AUDIENCE).toBe("example-api");
  });

  it("rejects insecure production cookies and missing envelope encryption", () => {
    expect(() =>
      parseAuthEnv({
        ...base,
        NODE_ENV: "production",
        APP_ENV: "production",
        BETTER_AUTH_SECRET: "x".repeat(48),
        API_PUBLIC_URL: "https://api.example.com",
        OIDC_ISSUER_URL: "https://auth.example.com",
        WEB_ORIGIN: "https://example.com",
        ALLOW_HTTP_COOKIES: "true",
      }),
    ).toThrow("Invalid auth app environment variables");
  });
});
