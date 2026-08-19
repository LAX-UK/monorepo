import { ACCESS_TOKEN_TTL_SECONDS, allRegisteredOidcScopes } from "@auction/identity-contracts";
import type { BetterAuthPlugin } from "better-auth";
import { magicLink, twoFactor } from "better-auth/plugins";
import { jwt } from "better-auth/plugins/jwt";
import { oidcProvider } from "better-auth/plugins/oidc-provider";
import { AUTH_TIMINGS } from "../auth-timings.js";
import type { EnvelopeCrypto } from "../crypto/envelope.js";
import { pickMagicLinkTemplate } from "../magic-link-email.js";
import { buildMagicLinkVerifyPlugin } from "../magic-link-verify-hooks.js";
import { buildOidcConsentHtml } from "../oidc-consent-html.js";
import {
  buildPhoneNumberGuardPlugin,
  buildPhoneNumberPlugin,
  buildPhoneNumberRateLimitPlugin,
} from "../phone-number-plugin.js";
import type {
  AccountLinkReader,
  EmailSender,
  JwksStore,
  PhoneNumberStore,
  SmsSender,
} from "../ports/index.js";
import { buildTwoFactorEnforcementPlugin } from "../two-factor-enforcement.js";

export function buildJwtAndOidcPlugins(options: {
  jwksStore: JwksStore;
  accountLinkReader: AccountLinkReader;
  phoneNumberStore: PhoneNumberStore;
  issuer: string;
  webOrigin?: string | undefined;
  jwtAudience: string;
  totpIssuer?: string | undefined;
  envelope?: EnvelopeCrypto | undefined;
  email?: EmailSender | undefined;
  phoneVerification?: SmsSender | undefined;
  onEmailVerified?:
    | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
    | undefined;
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
}): BetterAuthPlugin[] {
  const jwksAdapter = options.jwksStore;
  const { issuer, webOrigin, jwtAudience, email, phoneVerification, onEmailVerified } = options;
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
        expirationTime: `${ACCESS_TOKEN_TTL_SECONDS} seconds`,
        definePayload: ({ user: sessionUser }) => ({
          email: sessionUser.email,
          email_verified: sessionUser.emailVerified,
          name: sessionUser.name,
        }),
      },
      adapter: {
        getJwks: () => jwksAdapter.getJwks(),
        createJwk: (data) => jwksAdapter.createJwk(data),
      },
    }),
    oidcProvider({
      __skipDeprecationWarning: true,
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenExpiresIn: AUTH_TIMINGS.oidcRefreshTokenExpiresSec,
      storeClientSecret: "hashed",
      loginPage: `${webOrigin ?? issuer}/login`,
      useJWTPlugin: true,
      requirePKCE: true,
      scopes: [...allRegisteredOidcScopes()],
      getConsentHTML: ({ clientName, scopes, code }) =>
        buildOidcConsentHtml({ clientName, scopes, code }),
      metadata: {
        issuer,
        jwks_uri: `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`,
      },
      getAdditionalUserInfoClaim: async (sessionUser, _scopes, client) => ({
        email_verified: sessionUser.emailVerified,
        ...(options.resolveOidcIdTokenClaims
          ? await options.resolveOidcIdTokenClaims({
              subjectId: sessionUser.id,
              clientId: client.clientId,
            })
          : {}),
      }),
    }),
    twoFactor({ issuer: options.totpIssuer ?? "LAX", allowPasswordless: true }),
    magicLink({
      disableSignUp: true,
      storeToken: "hashed",
      expiresIn: AUTH_TIMINGS.magicLinkExpiresSec,
      sendMagicLink: async ({ email: recipientEmail, token }, ctx) => {
        if (!ctx) return;
        const found = await ctx.context.internalAdapter.findUserByEmail(recipientEmail);
        const authUser = found?.user;
        if (!authUser) return;
        const linkedCount = await options.accountLinkReader.countAccountsForUser(authUser.id);
        const template = pickMagicLinkTemplate(linkedCount > 0);
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
    buildPhoneNumberPlugin({
      phoneNumberStore: options.phoneNumberStore,
      phoneVerification,
      email,
    }),
    buildPhoneNumberRateLimitPlugin(),
    buildPhoneNumberGuardPlugin(options.phoneNumberStore),
  ];
}
