import { describe, expect, it } from "vitest";
import {
  isAllowedContinueUrl,
  magicLinkCallbackUrl,
  productHintLoginUrl,
  resolveContinueUrl,
  verificationCallbackUrl,
} from "./continue.js";

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
    const shopAdmin = "http://localhost:3030";
    expect(
      isAllowedContinueUrl(`${shopIdentity}/auth/callback?code=x`, origin, [shopIdentity]),
    ).toBe(true);
    expect(isAllowedContinueUrl(`${shopAdmin}/api/auth/callback?code=x`, origin, [shopAdmin])).toBe(
      true,
    );
    expect(isAllowedContinueUrl(`${shopAdmin}/api/auth/callbackx`, origin, [shopAdmin])).toBe(
      false,
    );
    expect(isAllowedContinueUrl("https://evil.example/auth/callback", origin, [shopIdentity])).toBe(
      false,
    );
    expect(
      isAllowedContinueUrl("https://evil.example/api/auth/callback", origin, [shopAdmin]),
    ).toBe(false);
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

describe("magicLinkCallbackUrl", () => {
  const authorize = "/api/auth/oauth2/authorize?client_id=lax-shop-web&state=abc";

  it("returns the pending authorize request so the destination survives the link and any 2FA step", () => {
    expect(
      magicLinkCallbackUrl(origin, { authorizeResumePath: authorize, loginPath: "/login" }, []),
    ).toBe(`${origin}${authorize}`);
  });

  it("falls back to the login page with the client hint", () => {
    expect(
      magicLinkCallbackUrl(
        origin,
        { authorizeResumePath: null, loginPath: "/login?client_id=lax-shop-web" },
        [],
      ),
    ).toBe(`${origin}/login?client_id=lax-shop-web`);
  });

  it("refuses a resume path that is not an allowed continuation", () => {
    expect(
      magicLinkCallbackUrl(
        origin,
        { authorizeResumePath: "https://evil.example/x", loginPath: "/login" },
        [],
      ),
    ).toBe(`${origin}/login`);
  });
});

describe("verificationCallbackUrl", () => {
  it("keeps the client hint of the current flow", () => {
    expect(verificationCallbackUrl(origin, "/login?client_id=lax-art-web")).toBe(
      `${origin}/verify-email?client_id=lax-art-web`,
    );
  });

  it("omits it when the flow has none", () => {
    expect(verificationCallbackUrl(origin, "/login")).toBe(`${origin}/verify-email`);
  });
});
