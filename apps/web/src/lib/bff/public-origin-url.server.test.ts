import { afterEach, describe, expect, it, vi } from "vitest";
import { isLoopbackHostname, resolvePublicOriginUrl } from "./public-origin-url.server";

describe("isLoopbackHostname", () => {
  it("recognizes common local bind addresses", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("0.0.0.0")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("lax.bid")).toBe(false);
  });
});

describe("resolvePublicOriginUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("targets the canonical public origin regardless of bind host", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("OIDC_ISSUER_URL", "http://localhost:3003");
    vi.stubEnv("OIDC_CLIENT_SECRET_LAX_BID_WEB", "test-secret-at-least-32-characters-long");
    vi.stubEnv("BID_BFF_SESSION_ENCRYPTION_KEY", "ci-test-bff-session-encryption-key-value");

    expect(resolvePublicOriginUrl("/admin").toString()).toBe("http://localhost:3000/admin");
    expect(resolvePublicOriginUrl("/login?error=oidc_callback").toString()).toBe(
      "http://localhost:3000/login?error=oidc_callback",
    );
  });

  it("uses production site origin when configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://lax.bid");
    vi.stubEnv("OIDC_ISSUER_URL", "https://auth.lax.bid");
    vi.stubEnv("OIDC_CLIENT_SECRET_LAX_BID_WEB", "test-secret-at-least-32-characters-long");
    vi.stubEnv("BID_BFF_SESSION_ENCRYPTION_KEY", "ci-test-bff-session-encryption-key-value");

    expect(resolvePublicOriginUrl("/dashboard").toString()).toBe("https://lax.bid/dashboard");
  });
});
