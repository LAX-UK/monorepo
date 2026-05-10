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
 * JWT access tokens (15m) are configured via the `jwt` plugin separately from
 * the DB-backed session cookie TTL (`session.expiresIn` / `updateAge` below).
 */

import type { Database } from "@auction/db";
import {
  account,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  session,
  user,
  verification,
} from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins/jwt";
import { oidcProvider } from "better-auth/plugins/oidc-provider";
import { createJwksAdapter } from "./jwks.js";

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
  requireEmailVerification?: boolean | undefined;
  /** Invoked from `databaseHooks.user.create.after` for every new auth user (email + OAuth).
   * The api wires this to provision the user's personal legal entity (Phase B / SE-P24).
   * Errors are caught + logged and never block account creation.
   */
  onUserCreated?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
};

export type Auth = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession(input: { headers: Headers }): Promise<{
      user?: { id?: string; role?: string | null } | null;
    } | null>;
    signUpEmail(input: { body: { name: string; email: string; password: string } }): Promise<{
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
  const jwksAdapter = createJwksAdapter(env.db);
  const socialProviders = createSocialProviders(env);

  return betterAuth({
    secret: env.secret,
    baseURL: issuer,
    basePath: "/api/auth",
    trustedOrigins: env.trustedOrigins,
    database: drizzleAdapter(env.db, {
      provider: "pg",
      schema: {
        user,
        session,
        account,
        verification,
        oauthApplication,
        oauthAccessToken,
        oauthConsent,
      },
    }),
    socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "apple"],
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
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: env.requireEmailVerification ?? true,
      sendResetPassword: async ({ user: authUser, url }) => {
        void env.email?.enqueue({
          template: "reset-password",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: {
            resetLink: url,
            userEmail: authUser.email,
            userName: authUser.name,
            expirationMinutes: 60,
          },
        });
      },
      onPasswordReset: async ({ user: authUser }) => {
        void env.email?.enqueue({
          template: "password-changed",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: { userName: authUser.name },
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user: authUser, url }) => {
        void env.email?.enqueue({
          template: "verify-email",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: { verificationUrl: url, userName: authUser.name },
        });
      },
      afterEmailVerification: async (authUser) => {
        void env.email?.enqueue({
          template: "welcome",
          to: authUser.email,
          userId: authUser.id,
          category: "transactional",
          vars: { userName: authUser.name },
        });
      },
    },
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
            void env.email?.enqueue({
              template: "welcome",
              to: authUser.email,
              userId: authUser.id,
              category: "transactional",
              vars: { userName: authUser.name },
            });
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      jwt({
        jwks: {
          jwksPath: "/.well-known/jwks.json",
          keyPairConfig: {
            alg: "RS256",
            modulusLength: 2048,
          },
          gracePeriod: 60 * 30,
        },
        jwt: {
          issuer,
          expirationTime: "15 minutes",
          definePayload: ({ user: sessionUser }) => ({
            email: sessionUser.email,
            email_verified: sessionUser.emailVerified,
            name: sessionUser.name,
            image: sessionUser.image,
            role: (sessionUser as { role?: string }).role ?? "client",
          }),
        },
        adapter: {
          getJwks: () => jwksAdapter.getJwks(),
          createJwk: (data) => jwksAdapter.createJwk(data),
        },
      }),
      oidcProvider({
        __skipDeprecationWarning: true,
        accessTokenExpiresIn: 60 * 15,
        refreshTokenExpiresIn: 60 * 60 * 24 * 30,
        loginPage: `${env.webOrigin ?? issuer}/login`,
        useJWTPlugin: true,
        requirePKCE: true,
        scopes: ["openid", "profile", "email", "offline_access"],
        metadata: {
          issuer,
          jwks_uri: `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`,
        },
        getAdditionalUserInfoClaim: (sessionUser) => ({
          email_verified: sessionUser.emailVerified,
          role: (sessionUser as { role?: string }).role ?? "client",
        }),
      }),
    ],
    advanced: {
      // Allow cookies over HTTP when explicitly enabled (for testing without HTTPS)
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
