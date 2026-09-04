/**
 * Better Auth session cookie security (verified against `better-auth@1.6.9`,
 * `dist/cookies/index.mjs` → `createCookie`):
 *
 * - **httpOnly:** `true` on all auth cookies (session token, session data cache,
 *   account store, etc.).
 * - **sameSite:** `"lax"` by default; merged with {@link AuthEnv} `cookieDomain`
 *   overrides below.
 * - **secure:** `true` on the cookie *attributes* when Better Auth uses the
 *   `__Secure-` name prefix. That prefix is applied when `advanced.useSecureCookies`
 *   is explicitly set, **or** when `baseURL` uses `https:`, **or** when
 *   `NODE_ENV` is production (`isProduction` from `@better-auth/core/env`).
 *   Local HTTP dev therefore gets non-`__Secure-` names unless you force HTTPS.
 * - **This wrapper:** `advanced.useSecureCookies` is set to `false` only when
 *   `allowInsecureCookies` is true (tests). When `cookieDomain` is set for
 *   cross-subdomain cookies, `defaultCookieAttributes` adds
 *   `{ domain, sameSite: "lax", secure: true }`, aligning session cookies with
 *   HTTPS production deployments.
 *
 * **`__Host-` prefix:** Not used — incompatible with `Domain` for `*.lax.bid`.
 *
 * JWT access tokens (15m) are configured via the `jwt` plugin separately from
 * the DB-backed session cookie TTL (`session.expiresIn` / `updateAge` below).
 */

import { betterAuth } from "better-auth";
import { buildDatabaseHooks } from "./auth-hooks/database-hooks.js";
import { AUTH_TIMINGS, DEFAULT_JWT_AUDIENCE } from "./auth-timings.js";
import type { AuthLifecycleCallbacks } from "./contracts.js";
import type { AuthDatabase } from "./phone-number-plugin.js";
import type { AuthPorts } from "./ports/index.js";
import {
  buildEmailAndPasswordBlock,
  buildEmailVerificationBlock,
  buildJwtAndOidcPlugins,
} from "./server-plugins.js";

export type AuthEnv = {
  /** Better Auth database adapter from `buildDrizzleDatabase` in apps/auth. */
  database: AuthDatabase;
  ports: AuthPorts;
  secret: string;
  /** e.g. http://localhost:3001 */
  baseURL: string;
  /** Stable external OIDC issuer, e.g. https://auth.lax.bid */
  issuerURL?: string | undefined;
  trustedOrigins?: string[] | undefined;
  /** Set to true to allow cookies over HTTP (non-HTTPS). Only for testing! */
  allowInsecureCookies?: boolean;
  webOrigin?: string | undefined;
  googleClientId?: string | undefined;
  googleClientSecret?: string | undefined;
  appleClientId?: string | undefined;
  /** Apple client secret JWT. If absent, Apple is feature-flagged off. */
  appleClientSecret?: string | undefined;
  requireEmailVerification?: boolean | undefined;
  /** First-party JWT `aud` claim consumed by product APIs. */
  jwtAudience?: string | undefined;
  /** TOTP issuer label shown in authenticator apps. */
  totpIssuer?: string | undefined;
  /** URL for the sessions settings page linked from password-reset emails. */
  sessionsSettingsUrl?: string | undefined;
  /** Called after password reset succeeds — revoke all other sessions; returns count of revoked rows (optional; wired in apps/api). */
  revokeAllSessions?: ((userId: string) => Promise<number>) | undefined;
  /** Invoked from `databaseHooks.user.create.after` for every new auth user (email + OAuth).
   * The api wires this to provision the user's personal legal entity (Phase B / SE-P24).
   * Errors are caught + logged and never block account creation.
   */
  onUserCreated?: AuthLifecycleCallbacks["onUserCreated"];
  /** Called after the first account row is created. OAuth signup attribution uses
   * this because Better Auth creates the user before its provider account.
   */
  onAccountCreated?: AuthLifecycleCallbacks["onAccountCreated"];
  /** Invoked from `emailVerification.afterEmailVerification` when the user confirms their email. */
  onEmailVerified?: AuthLifecycleCallbacks["onEmailVerified"];
  /** Invoked from `databaseHooks.user.update.after` when canonical profile fields change. */
  onUserUpdated?:
    | ((authUser: {
        id: string;
        email: string;
        name: string;
        phoneNumber?: string | null;
        image?: string | null;
      }) => Promise<void>)
    | undefined;
  /**
   * When `true`, `databaseHooks.session.create.after` fires a `new-device-login` email
   * for every new session. Enabled in production; leave unset in tests.
   */
  enableNewDeviceLoginEmail?: boolean | undefined;
  /** Request-scoped claims resolver used by the OIDC authorization-code flow. */
  resolveOidcIdTokenClaims?:
    | ((input: {
        subjectId: string;
        clientId: string;
      }) => Promise<{
        sid?: string;
        auth_time?: number;
        acr?: string;
        amr?: string[];
      }>)
    | undefined;
};

export type Auth = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getJwks(): Promise<{ keys: unknown[] }>;
    getSession(input: { headers: Headers }): Promise<{
      session?: { id?: string } | null;
      user?: { id?: string } | null;
    } | null>;
    signUpEmail(input: {
      body: { name: string; email: string; password: string; callbackURL?: string };
    }): Promise<{
      user?: { id?: string } | null;
    } | null>;
    requestPasswordReset(input: {
      body: { email: string; redirectTo?: string };
    }): Promise<unknown>;
    sendVerificationEmail(input: {
      body: { email: string; callbackURL?: string };
    }): Promise<unknown>;
  };
} & Record<string, unknown>;

export function createSocialProviders(
  env: Pick<
    AuthEnv,
    "googleClientId" | "googleClientSecret" | "appleClientId" | "appleClientSecret"
  >,
) {
  return {
    ...(env.googleClientId && env.googleClientSecret
      ? {
          google: {
            clientId: env.googleClientId,
            clientSecret: env.googleClientSecret,
          },
        }
      : {}),
    ...(env.appleClientId && env.appleClientSecret
      ? {
          apple: {
            clientId: env.appleClientId,
            clientSecret: env.appleClientSecret,
          },
        }
      : {}),
  };
}

export function createAuth(env: AuthEnv): Auth {
  const issuer = env.issuerURL ?? env.baseURL;
  const socialProviders = createSocialProviders(env);
  const jwtAudience = env.jwtAudience ?? DEFAULT_JWT_AUDIENCE;
  const totpIssuer = env.totpIssuer ?? "LAX";
  const sessionsSettingsUrl =
    env.sessionsSettingsUrl ??
    `${(env.webOrigin ?? "https://lax.bid").replace(/\/$/, "")}/dashboard/settings/sessions`;
  const { ports } = env;

  return betterAuth({
    secret: env.secret,
    baseURL: issuer,
    basePath: "/api/auth",
    trustedOrigins: env.trustedOrigins,
    database: env.database,
    socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        /** Empty: do not treat Google/Apple as "trusted" for linking without `email_verified`. */
        trustedProviders: [],
        /** Better Auth only counts account rows; we enforce the full sign-in pool in delete.before. */
        allowUnlinkingAll: true,
      },
    },
    user: {
      additionalFields: {
        phoneNumber: {
          type: "string",
          required: false,
          input: false,
        },
        phoneNumberVerified: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    emailAndPassword: buildEmailAndPasswordBlock({
      email: ports.email,
      requireEmailVerification: env.requireEmailVerification,
      revokeAllSessions: env.revokeAllSessions,
      sessionsSettingsUrl,
    }),
    emailVerification: buildEmailVerificationBlock({
      email: ports.email,
      onEmailVerified: env.onEmailVerified,
    }),
    databaseHooks: buildDatabaseHooks({
      ports: {
        subjectStatusReader: ports.subjectStatusReader,
        sessionCountReader: ports.sessionCountReader,
        accountLinkReader: ports.accountLinkReader,
        phoneNumberStore: ports.phoneNumberStore,
        email: ports.email,
      },
      onUserCreated: env.onUserCreated,
      onAccountCreated: env.onAccountCreated,
      onUserUpdated: env.onUserUpdated,
      enableNewDeviceLoginEmail: env.enableNewDeviceLoginEmail,
    }),
    session: {
      expiresIn: AUTH_TIMINGS.sessionExpiresSec,
      updateAge: AUTH_TIMINGS.sessionUpdateAgeSec,
      cookieCache: {
        enabled: true,
        maxAge: 300,
      },
    },
    plugins: buildJwtAndOidcPlugins({
      jwksStore: ports.jwksStore,
      accountLinkReader: ports.accountLinkReader,
      phoneNumberStore: ports.phoneNumberStore,
      issuer,
      webOrigin: env.webOrigin,
      jwtAudience,
      totpIssuer,
      email: ports.email,
      phoneVerification: ports.sms,
      onEmailVerified: env.onEmailVerified,
      resolveOidcIdTokenClaims: env.resolveOidcIdTokenClaims,
    }),
    advanced: {
      useSecureCookies: env.allowInsecureCookies ? false : undefined,
    },
  }) as unknown as Auth;
}

export { AUTH_TIMINGS, DEFAULT_JWT_AUDIENCE } from "./auth-timings.js";
export {
  applyAuthNoStoreHeaders,
  AUTH_NO_STORE_HEADERS,
  AUTH_RATE_LIMIT_POLICY,
  AUTH_ROUTE_PATH,
  buildOidcDiscoveryDocument,
  buildTrustedAuthOrigins,
  createAuthNoStoreMiddleware,
  createAuthLifecycleCallbacks,
  JWKS_PATH,
  normalizeAuthIssuerUrl,
  OIDC_DISCOVERY_PATH,
  type AuthLifecycleAccount,
  type AuthLifecycleAdapters,
  type AuthLifecycleCallbacks,
  type AuthLifecycleUser,
  type OidcDiscoveryDocument,
} from "./contracts.js";
export {
  runSignInTurnstileGate,
  isSignInEmailPost,
  isSignInMagicLinkPost,
  type SignInGateRedis,
} from "./sign-in-turnstile-gate.js";
export { verifyTurnstileResponse } from "./turnstile-siteverify.js";
export { stampLastPasswordAuthFromSignInResponse } from "./stamp-last-password-auth.js";
export {
  assertCanUnlinkAccount,
  shouldBlockLastAccountUnlink,
  shouldNotifySocialAccountLinked,
  SOCIAL_ACCOUNT_LINK_SIGNUP_THRESHOLD_MS,
} from "./account-linking.js";
