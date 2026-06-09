import type { Database } from "@auction/db";
import {
  account,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
} from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, twoFactor } from "better-auth/plugins";
import { jwt } from "better-auth/plugins/jwt";
import { oidcProvider } from "better-auth/plugins/oidc-provider";
import { eq } from "drizzle-orm";
import { wrapAuthDatabaseAdapter } from "./adapter-at-rest.js";
import { AUTH_TIMINGS } from "./auth-timings.js";
import type { EnvelopeCrypto } from "./crypto/envelope.js";
import { createJwksAdapter } from "./jwks.js";
import { pickMagicLinkTemplate } from "./magic-link-email.js";
import { buildMagicLinkVerifyPlugin } from "./magic-link-verify-hooks.js";
import { buildTwoFactorEnforcementPlugin } from "./two-factor-enforcement.js";

type RevokeSessions = (userId: string) => Promise<number>;

export function buildDrizzleDatabase(db: Database, envelope?: EnvelopeCrypto) {
  const inner = drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      oauthApplication,
      oauthAccessToken,
      oauthConsent,
      twoFactor: twoFactorTable,
    },
  });
  if (!envelope) return inner;
  type DrizzleAdapterOptions = Parameters<typeof inner>[0];
  return ((options: DrizzleAdapterOptions) =>
    wrapAuthDatabaseAdapter(inner(options) as never, envelope)) as unknown as ReturnType<
    typeof drizzleAdapter
  >;
}

export function buildJwtAndOidcPlugins(options: {
  db: Database;
  issuer: string;
  webOrigin?: string | undefined;
  jwtAudience: string;
  envelope?: EnvelopeCrypto | undefined;
  email?: IEmailService | undefined;
  onEmailVerified?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
}): BetterAuthPlugin[] {
  const jwksAdapter = createJwksAdapter(options.db, options.envelope);
  const { db, issuer, webOrigin, jwtAudience, email, onEmailVerified } = options;
  const webBase = (webOrigin ?? "https://lax.bid").replace(/\/$/, "");
  return [
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
        audience: jwtAudience,
        expirationTime: "15 minutes",
        definePayload: ({ user: sessionUser }) => ({
          email: sessionUser.email,
          email_verified: sessionUser.emailVerified,
          name: sessionUser.name,
          // `image` is intentionally excluded — it is PII (avatar URL) and not required
          // for authorization decisions; clients should fetch it from the userinfo endpoint.
          role: (sessionUser as { role?: string }).role ?? "client",
          staff_role: (sessionUser as { staffRole?: string | null }).staffRole ?? null,
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
      refreshTokenExpiresIn: AUTH_TIMINGS.oidcRefreshTokenExpiresSec,
      loginPage: `${webOrigin ?? issuer}/login`,
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
        staff_role: (sessionUser as { staffRole?: string | null }).staffRole ?? null,
      }),
    }),
    twoFactor({ issuer: "LAX" }),
    magicLink({
      disableSignUp: true,
      storeToken: "hashed",
      expiresIn: AUTH_TIMINGS.magicLinkExpiresSec,
      sendMagicLink: async ({ email: recipientEmail, token }, ctx) => {
        if (!ctx) return;
        const found = await ctx.context.internalAdapter.findUserByEmail(recipientEmail);
        const authUser = found?.user;
        if (!authUser) return;
        // Any linked account (credential or social) means an established user —
        // only truly account-less users (seeded passwordless) get activation copy.
        const [linked] = await db
          .select({ id: account.id })
          .from(account)
          .where(eq(account.userId, authUser.id))
          .limit(1);
        const template = pickMagicLinkTemplate(Boolean(linked));
        const linkUrl = `${webBase}/auth/activate?token=${encodeURIComponent(token)}`;
        const expirationMinutes = Math.round(AUTH_TIMINGS.magicLinkExpiresSec / 60);
        const baseEnqueue = {
          to: recipientEmail,
          userId: authUser.id,
          category: "auth" as const,
        };
        email
          ?.enqueue(
            template === "sign-in-link"
              ? {
                  ...baseEnqueue,
                  template: "sign-in-link",
                  vars: {
                    signInUrl: linkUrl,
                    userName: authUser.name,
                    expirationMinutes,
                  },
                }
              : {
                  ...baseEnqueue,
                  template: "account-activation",
                  vars: {
                    activationUrl: linkUrl,
                    userName: authUser.name,
                    expirationMinutes,
                  },
                },
          )
          .catch((err: unknown) => {
            console.error(`[auth] enqueue ${template} failed`, {
              userId: authUser.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      },
    }),
    buildMagicLinkVerifyPlugin({ onEmailVerified }),
    buildTwoFactorEnforcementPlugin({ webOrigin }),
  ];
}

export function buildEmailAndPasswordBlock(options: {
  email?: IEmailService | undefined;
  requireEmailVerification?: boolean | undefined;
  revokeAllSessions?: RevokeSessions | undefined;
  webOrigin?: string | undefined;
}) {
  const { email, requireEmailVerification, revokeAllSessions, webOrigin } = options;
  const sessionsSettingsUrl = `${(webOrigin ?? "https://lax.bid").replace(/\/$/, "")}/dashboard/settings/sessions`;
  return {
    enabled: true,
    requireEmailVerification: requireEmailVerification ?? true,
    resetPasswordTokenExpiresIn: AUTH_TIMINGS.resetPasswordExpiresSec,
    sendResetPassword: async ({
      user: authUser,
      url,
    }: { user: { id: string; email: string; name: string }; url: string }) => {
      email
        ?.enqueue({
          template: "reset-password",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: {
            resetLink: url,
            userEmail: authUser.email,
            userName: authUser.name,
            expirationMinutes: Math.round(AUTH_TIMINGS.resetPasswordExpiresSec / 60),
          },
        })
        .catch((err: unknown) => {
          console.error("[auth] enqueue reset-password failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
    onPasswordReset: async ({
      user: authUser,
    }: { user: { id: string; email: string; name: string } }) => {
      let revokedCount = 0;
      try {
        if (revokeAllSessions) {
          revokedCount = await revokeAllSessions(authUser.id);
        }
      } catch (e) {
        console.error("[auth] revokeAllSessions on password reset failed", {
          userId: authUser.id,
          error: e instanceof Error ? e.message : String(e),
        });
        email
          ?.enqueue({
            template: "password-changed-sessions-not-revoked",
            to: authUser.email,
            userId: authUser.id,
            category: "auth",
            vars: {
              userName: authUser.name,
              sessionsSettingsUrl,
            },
          })
          .catch((err: unknown) => {
            console.error("[auth] enqueue password-changed-sessions-not-revoked failed", {
              userId: authUser.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
      email
        ?.enqueue({
          template: "password-changed",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: { userName: authUser.name },
        })
        .catch((err: unknown) => {
          console.error("[auth] enqueue password-changed failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      if (revokedCount > 0) {
        email
          ?.enqueue({
            template: "password-changed-elsewhere",
            to: authUser.email,
            userId: authUser.id,
            category: "auth",
            vars: { userName: authUser.name },
          })
          .catch((err: unknown) => {
            console.error("[auth] enqueue password-changed-elsewhere failed", {
              userId: authUser.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
    },
  };
}

export function buildEmailVerificationBlock(options?: {
  email?: IEmailService | undefined;
  onEmailVerified?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
}) {
  const email = options?.email;
  const onEmailVerified = options?.onEmailVerified;
  return {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: AUTH_TIMINGS.emailVerificationExpiresSec,
    sendVerificationEmail: async ({
      user: authUser,
      url,
    }: {
      user: { id: string; email: string; name: string };
      url: string;
    }) => {
      email
        ?.enqueue({
          template: "verify-email",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: { verificationUrl: url, userName: authUser.name },
        })
        .catch((err: unknown) => {
          console.error("[auth] enqueue verify-email failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
    afterEmailVerification: async (authUser: { id: string; email: string; name: string }) => {
      if (onEmailVerified) {
        try {
          await onEmailVerified(authUser);
        } catch (err) {
          console.error("[auth] onEmailVerified failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      email
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
  };
}
