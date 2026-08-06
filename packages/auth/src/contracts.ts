export const AUTH_ROUTE_PATH = "/api/auth";
export const JWKS_PATH = "/.well-known/jwks.json";
export const OIDC_DISCOVERY_PATH = "/.well-known/openid-configuration";
export const AUTH_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
} as const;

/** Shared sliding-window thresholds for every host exposing auth routes. */
export const AUTH_RATE_LIMIT_POLICY = {
  authGeneralWindowSec: 60,
  authGeneralMax: 30,
  signInWindowSec: 15 * 60,
  signInMax: 5,
  forgotIpWindowSec: 60,
  forgotIpMax: 5,
  forgotEmailWindowSec: 60 * 60,
  forgotEmailMax: 3,
  setupPasswordWindowSec: 60,
  setupPasswordMax: 3,
  totpWindowSec: 15 * 60,
  totpMax: 5,
  totpLockoutSec: 30 * 60,
  confirmEmailChangeWindowSec: 60,
  confirmEmailChangeMax: 10,
  magicLinkIpWindowSec: 60,
  magicLinkIpMax: 5,
  magicLinkEmailWindowSec: 60 * 60,
  magicLinkEmailMax: 3,
  inviteWindowSec: 60 * 60,
  inviteMax: 30,
  invitePreviewWindowSec: 60,
  invitePreviewMax: 20,
  registerIpWindowSec: 60 * 60,
  registerIpMax: 10,
  registerEmailWindowSec: 60 * 60,
  registerEmailMax: 3,
  sendVerificationIpWindowSec: 60,
  sendVerificationIpMax: 5,
  sendVerificationEmailWindowSec: 60 * 60,
  sendVerificationEmailMax: 3,
} as const;

export type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported: readonly ["code"];
  response_modes_supported: readonly ["query"];
  grant_types_supported: readonly ["authorization_code", "refresh_token"];
  acr_values_supported: readonly ["urn:mace:incommon:iap:silver", "urn:mace:incommon:iap:bronze"];
  subject_types_supported: readonly ["public"];
  id_token_signing_alg_values_supported: readonly ["RS256"];
  scopes_supported: readonly ["openid", "profile", "email", "offline_access"];
  token_endpoint_auth_methods_supported: readonly [
    "client_secret_basic",
    "client_secret_post",
    "none",
  ];
  claims_supported: readonly [
    "sub",
    "iss",
    "aud",
    "exp",
    "nbf",
    "iat",
    "jti",
    "email",
    "email_verified",
    "name",
    "role",
    "staff_role",
  ];
  code_challenge_methods_supported: readonly ["S256"];
};

export function normalizeAuthIssuerUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Stable discovery response shared by the dual-hosted API and standalone auth app. */
export function buildOidcDiscoveryDocument(issuerUrl: string): OidcDiscoveryDocument {
  const issuer = normalizeAuthIssuerUrl(issuerUrl);
  const authBase = `${issuer}${AUTH_ROUTE_PATH}`;
  return {
    issuer,
    authorization_endpoint: `${authBase}/oauth2/authorize`,
    token_endpoint: `${authBase}/oauth2/token`,
    userinfo_endpoint: `${authBase}/oauth2/userinfo`,
    jwks_uri: `${issuer}${JWKS_PATH}`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    acr_values_supported: ["urn:mace:incommon:iap:silver", "urn:mace:incommon:iap:bronze"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    claims_supported: [
      "sub",
      "iss",
      "aud",
      "exp",
      "nbf",
      "iat",
      "jti",
      "email",
      "email_verified",
      "name",
      "role",
      "staff_role",
    ],
    code_challenge_methods_supported: ["S256"],
  };
}

export function applyAuthNoStoreHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    headers.set(name, value);
  }
}

/** Hono-compatible middleware without coupling the auth package to an HTTP framework. */
export function createAuthNoStoreMiddleware() {
  return async (
    context: { header(name: string, value: string): void },
    next: () => Promise<void>,
  ): Promise<void> => {
    await next();
    for (const [name, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
      context.header(name, value);
    }
  };
}

export function buildTrustedAuthOrigins(input: {
  webOrigin: string;
  webOrigins?: readonly string[] | undefined;
  additionalOrigins?: readonly string[] | undefined;
}): string[] {
  const origins =
    input.webOrigins && input.webOrigins.length > 0 ? [...input.webOrigins] : [input.webOrigin];
  for (const origin of input.additionalOrigins ?? []) {
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

export type AuthLifecycleUser = { id: string; email: string; name: string };
export type AuthLifecycleAccount = { userId: string; providerId: string };

export type AuthLifecycleCallbacks = {
  onUserCreated?: ((user: AuthLifecycleUser) => Promise<void>) | undefined;
  onAccountCreated?: ((account: AuthLifecycleAccount) => Promise<void>) | undefined;
  onEmailVerified?: ((user: AuthLifecycleUser) => Promise<void>) | undefined;
};

export type AuthLifecycleAdapters = {
  markUserForOAuthAttribution?: ((userId: string) => Promise<void>) | undefined;
  ensurePersonalLegalEntity?: ((user: AuthLifecycleUser) => Promise<unknown>) | undefined;
  publishUserRegisteredForAccount?: ((account: AuthLifecycleAccount) => Promise<void>) | undefined;
  completeOAuthAttribution?: ((account: AuthLifecycleAccount) => Promise<void>) | undefined;
  publishUserEmailVerified?: ((user: AuthLifecycleUser) => Promise<void>) | undefined;
  onNonBlockingError?:
    | ((stage: "oauth-attribution", error: unknown, subjectId: string) => void)
    | undefined;
};

/**
 * Defines lifecycle ordering once while leaving database, Redis, and event adapters
 * in each deployable application's composition root.
 */
export function createAuthLifecycleCallbacks(
  adapters: AuthLifecycleAdapters,
): AuthLifecycleCallbacks {
  return {
    onUserCreated: async (user) => {
      if (adapters.markUserForOAuthAttribution) {
        await adapters.markUserForOAuthAttribution(user.id).catch((error: unknown) => {
          adapters.onNonBlockingError?.("oauth-attribution", error, user.id);
        });
      }
      await adapters.ensurePersonalLegalEntity?.(user);
    },
    onAccountCreated:
      adapters.completeOAuthAttribution || adapters.publishUserRegisteredForAccount
        ? async (account) => {
            await adapters.completeOAuthAttribution?.(account);
            await adapters.publishUserRegisteredForAccount?.(account);
          }
        : undefined,
    onEmailVerified: adapters.publishUserEmailVerified
      ? async (user) => {
          await adapters.publishUserEmailVerified?.(user);
        }
      : undefined,
  };
}
