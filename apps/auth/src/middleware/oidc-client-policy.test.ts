import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  createOidcClientPolicyMiddleware,
  validateOidcAuthorizationRequest,
} from "./oidc-client-policy.js";

function validParams(): URLSearchParams {
  return new URLSearchParams({
    client_id: "lax-shop-web",
    redirect_uri: "http://localhost:3010/auth/callback",
    response_type: "code",
    scope: "openid profile email shop.read",
    code_challenge: "challenge",
    code_challenge_method: "S256",
  });
}

describe("OIDC client policy", () => {
  it("accepts a registered client with exact redirect URI, scopes, and S256 PKCE", () => {
    expect(validateOidcAuthorizationRequest(validParams())).toBeNull();
  });

  it("rejects unregistered clients and redirect URI variations", () => {
    const unknown = validParams();
    unknown.set("client_id", "unknown");
    expect(validateOidcAuthorizationRequest(unknown)).toBe("invalid_client");

    const redirect = validParams();
    redirect.set("redirect_uri", "http://localhost:3010/auth/callback/");
    expect(validateOidcAuthorizationRequest(redirect)).toBe("invalid_redirect_uri");
  });

  it("rejects unsupported scopes and missing PKCE", () => {
    const scope = validParams();
    scope.set("scope", "openid admin");
    expect(validateOidcAuthorizationRequest(scope)).toBe("invalid_scope");

    const pkce = validParams();
    pkce.delete("code_challenge");
    expect(validateOidcAuthorizationRequest(pkce)).toBe("invalid_pkce");
  });

  it("returns protocol errors through a previously validated redirect URI", async () => {
    const app = new Hono();
    app.use("*", createOidcClientPolicyMiddleware());
    app.get("*", (c) => c.json({ ok: true }));
    const params = validParams();
    params.set("scope", "openid admin");
    params.set("state", "opaque-state");
    const response = await app.request(`/api/auth/oauth2/authorize?${params}`);
    expect(response.status).toBe(302);
    const redirect = new URL(response.headers.get("location") as string);
    expect(redirect.searchParams.get("error")).toBe("invalid_scope");
    expect(redirect.searchParams.get("state")).toBe("opaque-state");
  });
});
