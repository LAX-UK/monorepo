import { describe, expect, it } from "vitest";
import {
  buildAuthorizeUrl,
  buildEndSessionUrl,
  checkIdentityProvider,
  decodeJwtPayload,
  exchangeAuthorizationCode,
  generateOAuthLoginParams,
  resolveOidcDiscovery,
  validateIdTokenClaims,
  validateLogoutTokenClaims,
  validateOAuthState,
} from "./oidc.js";

describe("generateOAuthLoginParams", () => {
  it("generates unique state, nonce, and PKCE S256 challenge", () => {
    const first = generateOAuthLoginParams();
    const second = generateOAuthLoginParams();

    expect(first.state).toHaveLength(32);
    expect(first.nonce).toHaveLength(32);
    expect(first.codeVerifier).toHaveLength(43);
    expect(first.codeChallenge).toHaveLength(43);
    expect(first.state).not.toBe(second.state);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });
});

describe("OIDC logout", () => {
  const logoutClaims = {
    iss: "https://auth.example.test",
    aud: "lax-shop-web",
    iat: 1_700_000_000,
    jti: "jti-1",
    sid: "sid-1",
    events: { "http://schemas.openid.net/event/backchannel-logout": {} },
  };

  it("accepts the exact event and a fresh sid-targeted token", () => {
    expect(
      validateLogoutTokenClaims(logoutClaims, {
        issuer: "https://auth.example.test",
        clientId: "lax-shop-web",
        now: 1_700_000_100,
      }),
    ).toMatchObject({ jti: "jti-1", sid: "sid-1" });
  });

  it("rejects nonce, stale iat, wrong audience, missing target, and extra events", () => {
    const expected = {
      issuer: "https://auth.example.test",
      clientId: "lax-shop-web",
      now: 1_700_000_100,
    };
    expect(validateLogoutTokenClaims({ ...logoutClaims, nonce: "forbidden" }, expected)).toBeNull();
    expect(validateLogoutTokenClaims({ ...logoutClaims, iat: 1_699_999_000 }, expected)).toBeNull();
    expect(validateLogoutTokenClaims({ ...logoutClaims, aud: "other" }, expected)).toBeNull();
    expect(
      validateLogoutTokenClaims({ ...logoutClaims, sid: undefined, sub: undefined }, expected),
    ).toBeNull();
    expect(
      validateLogoutTokenClaims(
        { ...logoutClaims, events: { ...logoutClaims.events, other: {} } },
        expected,
      ),
    ).toBeNull();
  });

  it("builds RP-initiated logout with the registered callback inputs", () => {
    const url = new URL(
      buildEndSessionUrl({
        discovery: resolveOidcDiscovery("https://auth.example.test"),
        clientId: "lax-shop-web",
        postLogoutRedirectUri: "https://shop.example.test/",
        state: "logout-state",
      }),
    );
    expect(url.pathname).toBe("/api/auth/oauth2/endsession");
    expect(url.searchParams.has("id_token_hint")).toBe(false);
    expect(url.searchParams.get("client_id")).toBe("lax-shop-web");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("https://shop.example.test/");
    expect(url.searchParams.get("state")).toBe("logout-state");
  });
});

describe("checkIdentityProvider", () => {
  it("accepts matching live discovery and rejects issuer drift", async () => {
    const validFetch = async () =>
      new Response(
        JSON.stringify({
          issuer: "https://auth.example.test",
          jwks_uri: "https://auth.example.test/.well-known/jwks.json",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    await expect(
      checkIdentityProvider("https://auth.example.test", validFetch as typeof fetch),
    ).resolves.toBeUndefined();

    const driftFetch = async () =>
      new Response(
        JSON.stringify({
          issuer: "https://evil.example.test",
          jwks_uri: "https://auth.example.test/.well-known/jwks.json",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    await expect(
      checkIdentityProvider("https://auth.example.test", driftFetch as typeof fetch),
    ).rejects.toThrow("contract mismatch");
  });
});

describe("buildAuthorizeUrl", () => {
  it("includes PKCE, state, and nonce query params", () => {
    const discovery = resolveOidcDiscovery("https://auth.example.test");
    const params = generateOAuthLoginParams();
    const url = new URL(
      buildAuthorizeUrl({
        discovery,
        clientId: "lax-shop-web",
        redirectUri: "https://shop.example.test/auth/callback",
        params,
      }),
    );

    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("lax-shop-web");
    expect(url.searchParams.get("redirect_uri")).toBe("https://shop.example.test/auth/callback");
    expect(url.searchParams.get("state")).toBe(params.state);
    expect(url.searchParams.get("nonce")).toBe(params.nonce);
    expect(url.searchParams.get("code_challenge")).toBe(params.codeChallenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("validateOAuthState", () => {
  it("accepts matching state and rejects mismatches", () => {
    expect(validateOAuthState("abc", "abc")).toBe(true);
    expect(validateOAuthState("abc", "def")).toBe(false);
    expect(validateOAuthState(undefined, "abc")).toBe(false);
  });
});

describe("validateIdTokenClaims", () => {
  it("requires issuer, audience, nonce, and subject", () => {
    const expected = {
      issuer: "https://auth.example.test/",
      clientId: "lax-shop-web",
      nonce: "nonce-123",
    };
    const valid = {
      sub: "user-1",
      iss: "https://auth.example.test",
      aud: "lax-shop-web",
      nonce: "nonce-123",
    };

    expect(validateIdTokenClaims(valid, expected)).toBe(true);
    expect(validateIdTokenClaims({ ...valid, aud: ["other", "lax-shop-web"] }, expected)).toBe(
      false,
    );
    expect(validateIdTokenClaims({ ...valid, nonce: "wrong" }, expected)).toBe(false);
    expect(validateIdTokenClaims({ ...valid, aud: "other" }, expected)).toBe(false);
    expect(validateIdTokenClaims({ ...valid, iss: "https://evil.example" }, expected)).toBe(false);
  });
});

describe("exchangeAuthorizationCode", () => {
  it("posts authorization_code grant with PKCE verifier", async () => {
    const discovery = resolveOidcDiscovery("https://auth.example.test");
    const calls: { url: string; body: string }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        body: String(init?.body ?? ""),
      });
      return new Response(
        JSON.stringify({
          id_token:
            "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS50ZXN0IiwiYXVkIjoibGF4LXNob3AtcHJvb2YiLCJub25jZSI6Im5vbmNlLTEyMyJ9.sig",
          access_token: "access-token",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const tokenResponse = await exchangeAuthorizationCode({
      discovery,
      clientId: "lax-shop-web",
      clientSecret: "secret",
      redirectUri: "https://shop.example.test/callback",
      code: "auth-code",
      codeVerifier: "verifier-123",
      fetchImpl,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(discovery.token_endpoint);
    const body = new URLSearchParams(calls[0]?.body ?? "");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("code_verifier")).toBe("verifier-123");
    expect(body.get("client_id")).toBe("lax-shop-web");
    expect(body.get("client_secret")).toBe("secret");
    expect(decodeJwtPayload(tokenResponse.id_token).sub).toBe("user-1");
  });

  it("decodes id_token claims for validation", () => {
    const claims = decodeJwtPayload(
      "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS50ZXN0IiwiYXVkIjoibGF4LXNob3AtcHJvb2YiLCJub25jZSI6Im5vbmNlLTEyMyJ9.sig",
    );
    expect(claims.sub).toBe("user-1");
    expect(claims.nonce).toBe("nonce-123");
  });
});
