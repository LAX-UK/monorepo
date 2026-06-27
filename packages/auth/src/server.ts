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

import type { Database } from "@auction/db";
import { session as sessionTable } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import type { IPhoneVerificationService } from "@auction/sms";
import { betterAuth } from "better-auth";
import { count, eq } from "drizzle-orm";
import { AUTH_TIMINGS, DEFAULT_JWT_AUDIENCE } from "./auth-timings.js";
import { parseAuthDekKey } from "./crypto/dek.js";
import { createEnvelopeCrypto } from "./crypto/envelope.js";
import { resetPhoneVerifiedIfNumberChanged } from "./phone-number-plugin.js";
import {
  buildDrizzleDatabase,
  buildEmailAndPasswordBlock,
  buildEmailVerificationBlock,
  buildJwtAndOidcPlugins,
} from "./server-plugins.js";
import { assertUserNotSuspendedForSession } from "./session-suspended-guard.js";

export type AuthEnv = {
  db: Database;
  secret: string;
  /** e.g. http://localhost:3001 */
  baseURL: string;
  /** Stable external OIDC issuer, e.g. https://auth.lax.bid */
  issuerURL?: string | undefined;
  trustedOrigins?: string[] | undefined;
  /** Set to true to allow cookies over HTTP (non-HTTPS). Only for testing! */
  allowInsecureCookies?: boolean;
  cookieDomain?: string | undefined;
  webOrigin?: string | undefined;
  googleClientId?: string | undefined;
  googleClientSecret?: string | undefined;
  appleClientId?: string | undefined;
  /** Apple client secret JWT. If absent, Apple is feature-flagged off. */
  appleClientSecret?: string | undefined;
  email?: IEmailService | undefined;
  phoneVerification?: IPhoneVerificationService | undefined;
  requireEmailVerification?: boolean | undefined;
  /** `aud` claim for JWTs consumed by `lax-api` (Bearer). OIDC clients may use separate audiences via issuer config. */
  jwtAudience?: string | undefined;
  /** When set (64 hex or base64 of 32 bytes), envelope-encrypts OAuth tokens, 2FA secrets, and JWKS private keys at rest. */
  authDekKey?: string | undefined;
  /** Called after password reset succeeds — revoke all other sessions; returns count of revoked rows (optional; wired in apps/api). */
  revokeAllSessions?: ((userId: string) => Promise<number>) | undefined;
  /** Invoked from `databaseHooks.user.create.after` for every new auth user (email + OAuth).
   * The api wires this to provision the user's personal legal entity (Phase B / SE-P24).
   * Errors are caught + logged and never block account creation.
   */
  onUserCreated?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
  /** Invoked from `emailVerification.afterEmailVerification` when the user confirms their email. */
  onEmailVerified?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
  /**
   * When `true`, `databaseHooks.session.create.after` fires a `new-device-login` email
   * for every new session. Enabled in production; leave unset in tests.
   */
  enableNewDeviceLoginEmail?: boolean | undefined;
};

export type Auth = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession(input: { headers: Headers }): Promise<{
      user?: { id?: string; role?: string | null; staffRole?: string | null } | null;
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
  const envelope =
    env.authDekKey && env.authDekKey.trim().length > 0
      ? createEnvelopeCrypto(parseAuthDekKey(env.authDekKey.trim()))
      : undefined;

  return betterAuth({
    secret: env.secret,
    baseURL: issuer,
    basePath: "/api/auth",
    trustedOrigins: env.trustedOrigins,
    database: buildDrizzleDatabase(env.db, envelope),
    socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        /** Empty: do not treat Google/Apple as "trusted" for linking without `email_verified`. */
        trustedProviders: [],
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "client",
          input: false,
        },
        staffRole: {
          type: "string",
          required: false,
          input: false,
        },
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
        mobileCountry: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    emailAndPassword: buildEmailAndPasswordBlock({
      email: env.email,
      requireEmailVerification: env.requireEmailVerification,
      revokeAllSessions: env.revokeAllSessions,
      webOrigin: env.webOrigin,
    }),
    emailVerification: buildEmailVerificationBlock({
      email: env.email,
      onEmailVerified: env.onEmailVerified,
    }),
    databaseHooks: {
      user: {
        create: {
          after: async (authUser) => {
            if (env.onUserCreated) {
              try {
                await env.onUserCreated({
                  id: authUser.id,
                  email: authUser.email,
                  name: authUser.name,
                });
              } catch (err) {
                console.error("[auth.user.create.after] onUserCreated failed", {
                  userId: authUser.id,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
            if (!authUser.emailVerified) return;
            env.email
              ?.enqueue({
                template: "welcome",
                to: authUser.email,
                userId: authUser.id,
                category: "transactional",
                vars: { userName: authUser.name },
              })
              .catch((err: unknown) => {
                console.error("[auth] enqueue welcome failed", {
                  userId: authUser.id,
                  error: err instanceof Error ? err.message : String(err),
                });
              });
          },
        },
        update: {
          before: async (userData) => {
            if (!("phoneNumber" in userData)) return;
            const userId = (userData as { id?: string }).id;
            if (!userId) return;
            const existing = await env.db.query.user.findFirst({
              where: (u, { eq }) => eq(u.id, userId),
              columns: { phoneNumber: true },
            });
            const nextPhone =
              userData.phoneNumber === null || userData.phoneNumber === undefined
                ? null
                : String(userData.phoneNumber);
            await resetPhoneVerifiedIfNumberChanged(
              env.db,
              userId,
              existing?.phoneNumber,
              nextPhone,
            );
          },
        },
      },
      session: {
        create: {
          before: async (sess) => {
            await assertUserNotSuspendedForSession(env.db, sess.userId);
          },
          after: async (sess) => {
            if (!env.enableNewDeviceLoginEmail) return;
            // Count all sessions for this user (the new one is already committed).
            // If count === 1 this is the very first session — the user just registered.
            // Don't send a "new device login" email in that case; they already receive
            // a welcome / email-verification email and the duplicate is confusing.
            const countResult = await env.db
              .select({ value: count() })
              .from(sessionTable)
              .where(eq(sessionTable.userId, sess.userId));
            const sessionCount = countResult[0]?.value ?? 0;
            if (sessionCount <= 1) return;
            const userRow = await env.db.query.user.findFirst({
              where: (u, { eq }) => eq(u.id, sess.userId),
              columns: { email: true, name: true },
            });
            if (!userRow) return;
            const when = new Date(sess.createdAt);
            env.email
              ?.enqueue({
                template: "new-device-login",
                to: userRow.email,
                userId: sess.userId,
                category: "auth",
                vars: {
                  userName: userRow.name,
                  whenDisplay: when.toUTCString(),
                  deviceSummary: (sess as { userAgent?: string | null }).userAgent ?? null,
                },
              })
              .catch((err: unknown) => {
                console.error("[auth] enqueue new-device-login failed", {
                  userId: sess.userId,
                  error: err instanceof Error ? err.message : String(err),
                });
              });
          },
        },
      },
    },
    session: {
      expiresIn: AUTH_TIMINGS.sessionExpiresSec,
      updateAge: AUTH_TIMINGS.sessionUpdateAgeSec,
      cookieCache: {
        enabled: true,
        maxAge: 300,
      },
    },
    plugins: buildJwtAndOidcPlugins({
      db: env.db,
      issuer,
      webOrigin: env.webOrigin,
      jwtAudience,
      envelope,
      email: env.email,
      phoneVerification: env.phoneVerification,
      onEmailVerified: env.onEmailVerified,
    }),
    advanced: {
      useSecureCookies: env.allowInsecureCookies ? false : undefined,
      crossSubDomainCookies: env.cookieDomain
        ? {
            enabled: true,
            domain: env.cookieDomain,
          }
        : undefined,
      defaultCookieAttributes: env.cookieDomain
        ? {
            domain: env.cookieDomain,
            sameSite: "lax",
            secure: true,
          }
        : undefined,
    },
  }) as Auth;
}

export { AUTH_TIMINGS, DEFAULT_JWT_AUDIENCE } from "./auth-timings.js";
export {
  runSignInTurnstileGate,
  isSignInEmailPost,
  isSignInMagicLinkPost,
  type SignInGateRedis,
} from "./sign-in-turnstile-gate.js";
export { verifyTurnstileResponse } from "./turnstile-siteverify.js";
export { stampLastPasswordAuthFromSignInResponse } from "./stamp-last-password-auth.js";
