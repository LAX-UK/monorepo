import { describe, expect, it } from "vitest";
import { isAllowedContinueUrl, productHintLoginUrl, resolveContinueUrl } from "./continue.js";

const origin = "http://localhost:3003";
const shopIdentity = "http://localhost:3010";

describe("isAllowedContinueUrl", () => {
  it("accepts issuer authorize, login, and two-factor paths", () => {
    expect(
      isAllowedContinueUrl("/api/auth/oauth2/authorize?client_id=lax-shop-web", origin, []),
    ).toBe(true);
    expect(isAllowedContinueUrl(`${origin}/login?client_id=lax-shop-web`, origin, [])).toBe(true);
    expect(isAllowedContinueUrl("/two-factor", origin, [])).toBe(true);
  });

  it("accepts registered relying-party callbacks only", () => {
    expect(
      isAllowedContinueUrl(`${shopIdentity}/auth/callback?code=x`, origin, [shopIdentity]),
    ).toBe(true);
    expect(isAllowedContinueUrl("https://evil.example/auth/callback", origin, [shopIdentity])).toBe(
      false,
    );
    expect(isAllowedContinueUrl(`${shopIdentity}/steal`, origin, [shopIdentity])).toBe(false);
  });

  it("rejects javascript and protocol-relative values", () => {
    expect(isAllowedContinueUrl("javascript:alert(1)", origin, [])).toBe(false);
    expect(isAllowedContinueUrl("//evil.example", origin, [])).toBe(false);
  });
});

describe("productHintLoginUrl", () => {
  it("keeps only the registered client_id", () => {
    expect(
      productHintLoginUrl(origin, "/login?client_id=lax-shop-web&code_challenge=abc&state=stale"),
    ).toBe(`${origin}/login?client_id=lax-shop-web`);
  });
});

describe("resolveContinueUrl", () => {
  const shopRestart = "http://localhost:3020/login";
  const config = {
    twoFactorPath: "/two-factor?client_id=lax-shop-web",
    authorizeResumePath: "/api/auth/oauth2/authorize?client_id=lax-shop-web",
    restartUrl: shopRestart,
    loginPath: "/login?client_id=lax-shop-web",
    allowedRedirectOrigins: [shopIdentity],
  };

  it("prefers two-factor, then an allowed payload URL, then authorize resume", () => {
    expect(resolveContinueUrl({ twoFactorRedirect: true }, origin, config)).toBe(
      `${origin}/two-factor?client_id=lax-shop-web`,
    );
    expect(
      resolveContinueUrl({ redirectURI: `${shopIdentity}/auth/callback` }, origin, config),
    ).toBe(`${shopIdentity}/auth/callback`);
    expect(resolveContinueUrl({}, origin, config)).toBe(
      `${origin}/api/auth/oauth2/authorize?client_id=lax-shop-web`,
    );
  });

  it("restarts at the product login when the prompt cookie can no longer resume", () => {
    expect(resolveContinueUrl({}, origin, { ...config, authorizeResumePath: null })).toBe(
      shopRestart,
    );
  });

  it("rejects untrusted payload URLs", () => {
    expect(
      resolveContinueUrl({ url: "https://evil.example/steal" }, origin, {
        ...config,
        authorizeResumePath: null,
      }),
    ).toBe(shopRestart);
  });
});
