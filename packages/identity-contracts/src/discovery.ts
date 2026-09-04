export const AUTH_ROUTE_PATH = "/api/auth";
export const JWKS_PATH = "/.well-known/jwks.json";
export const OIDC_DISCOVERY_PATH = "/.well-known/openid-configuration";
export const OIDC_END_SESSION_PATH = "/api/auth/oauth2/endsession";
export const OAUTH_REVOCATION_PATH = "/api/auth/oauth2/revoke";
export const OAUTH_INTROSPECTION_PATH = "/api/auth/oauth2/introspect";

export type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  revocation_endpoint: string;
  introspection_endpoint: string;
  jwks_uri: string;
  response_types_supported: readonly ["code"];
  response_modes_supported: readonly ["query"];
  grant_types_supported: readonly [
    "authorization_code",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:token-exchange",
  ];
  acr_values_supported: readonly ["urn:mace:incommon:iap:silver", "urn:mace:incommon:iap:bronze"];
  subject_types_supported: readonly ["public"];
  id_token_signing_alg_values_supported: readonly ["RS256"];
  scopes_supported: readonly [
    "openid",
    "profile",
    "email",
    "offline_access",
    "bid.read",
    "bid.write",
    "shop.read",
    "shop.write",
  ];
  token_endpoint_auth_methods_supported: readonly [
    "client_secret_basic",
    "client_secret_post",
    "none",
  ];
  revocation_endpoint_auth_methods_supported: readonly [
    "client_secret_basic",
    "client_secret_post",
  ];
  introspection_endpoint_auth_methods_supported: readonly [
    "client_secret_basic",
    "client_secret_post",
  ];
  backchannel_logout_supported: true;
  backchannel_logout_session_supported: true;
  claims_supported: readonly [
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
  ];
  code_challenge_methods_supported: readonly ["S256"];
};

export function normalizeIssuerUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Stable discovery response published by the canonical standalone auth app. */
export function buildOidcDiscoveryDocument(issuerUrl: string): OidcDiscoveryDocument {
  const issuer = normalizeIssuerUrl(issuerUrl);
  const authBase = `${issuer}${AUTH_ROUTE_PATH}`;
  return {
    issuer,
    authorization_endpoint: `${authBase}/oauth2/authorize`,
    token_endpoint: `${authBase}/oauth2/token`,
    userinfo_endpoint: `${authBase}/oauth2/userinfo`,
    end_session_endpoint: `${authBase}/oauth2/endsession`,
    revocation_endpoint: `${authBase}/oauth2/revoke`,
    introspection_endpoint: `${authBase}/oauth2/introspect`,
    jwks_uri: `${issuer}${JWKS_PATH}`,
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
  };
}
