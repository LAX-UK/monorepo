import { describe, expect, it } from "vitest";
import {
  AUTH_ROUTE_PATH,
  JWKS_PATH,
  OAUTH_INTROSPECTION_PATH,
  OAUTH_REVOCATION_PATH,
  OIDC_DISCOVERY_PATH,
  OIDC_END_SESSION_PATH,
  buildOidcDiscoveryDocument,
  normalizeIssuerUrl,
} from "./discovery.js";

describe("OIDC discovery contracts", () => {
  it("exposes frozen auth and well-known paths", () => {
    expect(AUTH_ROUTE_PATH).toBe("/api/auth");
    expect(JWKS_PATH).toBe("/.well-known/jwks.json");
    expect(OIDC_DISCOVERY_PATH).toBe("/.well-known/openid-configuration");
    expect(OIDC_END_SESSION_PATH).toBe("/api/auth/oauth2/endsession");
    expect(OAUTH_REVOCATION_PATH).toBe("/api/auth/oauth2/revoke");
    expect(OAUTH_INTROSPECTION_PATH).toBe("/api/auth/oauth2/introspect");
  });

  it("normalizes issuer URLs by trimming trailing slashes", () => {
    expect(normalizeIssuerUrl("https://auth.lax.bid///")).toBe("https://auth.lax.bid");
  });

  it("builds the frozen OIDC discovery document from a normalized issuer", () => {
    expect(buildOidcDiscoveryDocument("https://auth.lax.bid///")).toEqual({
      issuer: "https://auth.lax.bid",
      authorization_endpoint: "https://auth.lax.bid/api/auth/oauth2/authorize",
      token_endpoint: "https://auth.lax.bid/api/auth/oauth2/token",
      userinfo_endpoint: "https://auth.lax.bid/api/auth/oauth2/userinfo",
      end_session_endpoint: "https://auth.lax.bid/api/auth/oauth2/endsession",
      revocation_endpoint: "https://auth.lax.bid/api/auth/oauth2/revoke",
      introspection_endpoint: "https://auth.lax.bid/api/auth/oauth2/introspect",
      jwks_uri: "https://auth.lax.bid/.well-known/jwks.json",
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: [
        "authorization_code",
        "refresh_token",
        "urn:ietf:params:oauth:grant-type:token-exchange",
      ],
      acr_values_supported: ["urn:mace:incommon:iap:silver", "urn:mace:incommon:iap:bronze"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "bid.read",
        "bid.write",
        "shop.read",
        "shop.write",
      ],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
      revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      backchannel_logout_supported: true,
      backchannel_logout_session_supported: true,
      claims_supported: [
        "sub",
        "iss",
        "aud",
        "exp",
        "nbf",
        "iat",
        "jti",
        "sid",
        "auth_time",
        "acr",
        "amr",
        "email",
        "email_verified",
        "name",
      ],
      code_challenge_methods_supported: ["S256"],
    });
  });
});
