import {
  ACCESS_TOKEN_TTL_SECONDS,
  allRegisteredOidcScopes,
  oidcClientIdsWithImplicitConsent,
} from "@auction/identity-contracts";
import type { BetterAuthPlugin } from "better-auth";
import { magicLink, twoFactor } from "better-auth/plugins";
import { jwt } from "better-auth/plugins/jwt";
import { oidcProvider } from "better-auth/plugins/oidc-provider";
import { AUTH_TIMINGS } from "../auth-timings.js";
import { buildBreachedPasswordPlugin } from "../breached-password-plugin.js";
import type { EnvelopeCrypto } from "../crypto/envelope.js";
import { resolveMagicLinkUrl } from "../hosted-auth/magic-link-url.js";
import { pickMagicLinkTemplate } from "../magic-link-email.js";
import { buildMagicLinkVerifyPlugin } from "../magic-link-verify-hooks.js";
import { buildOidcConsentHtml } from "../oidc-consent-html.js";
import { buildPhoneNumberGuardPlugin, buildPhoneNumberPlugin } from "../phone-number-plugin.js";
import type { BreachedPasswordChecker } from "../ports/breached-password-checker.js";
import type {
  AccountLinkReader,
  EmailSender,
  JwksStore,
  PhoneNumberStore,
  SmsSender,
} from "../ports/index.js";
import { buildTwoFactorEnforcementPlugin } from "../two-factor-enforcement.js";

function normalizeOidcScopes(scopes: unknown): string[] {
  if (Array.isArray(scopes)) return scopes.map(String);
  if (typeof scopes === "string") return scopes.split(/\s+/).filter(Boolean);
  return [];
}

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
        lax_staff_platforms?: ("bid" | "shop")[];
      }>)
    | undefined;
  breachedPasswordChecker?: BreachedPasswordChecker | undefined;
}): BetterAuthPlugin[] {
  const jwksAdapter = options.jwksStore;
  const { issuer, webOrigin, jwtAudience, email, phoneVerification, onEmailVerified } = options;
  const issuerBase = issuer.replace(/\/$/, "");
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
      loginPage: `${issuerBase}/login`,
      useJWTPlugin: true,
      requirePKCE: true,
      scopes: [...allRegisteredOidcScopes()],
      skipConsentClientIds: [...oidcClientIdsWithImplicitConsent()],
      getConsentHTML: ({ clientName, scopes, code }) =>
        buildOidcConsentHtml({ clientName, scopes, code }),
      metadata: {
        issuer,
        jwks_uri: `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`,
      },
      getAdditionalUserInfoClaim: async (sessionUser, scopes, client) => {
        const scopeSet = new Set(normalizeOidcScopes(scopes));
        const profileClaims = scopeSet.has("profile")
          ? {
              ...(sessionUser.image ? { picture: sessionUser.image } : {}),
            }
          : {};
        const phoneClaims =
          scopeSet.has("phone") && sessionUser.phoneNumber && sessionUser.phoneNumberVerified
            ? {
                phone_number: sessionUser.phoneNumber,
                phone_number_verified: true,
              }
            : scopeSet.has("phone")
              ? {
                  phone_number: sessionUser.phoneNumber ?? undefined,
                  phone_number_verified: sessionUser.phoneNumberVerified ?? false,
                }
              : {};
        return {
          email_verified: sessionUser.emailVerified,
          ...profileClaims,
          ...phoneClaims,
          ...(options.resolveOidcIdTokenClaims
            ? await options.resolveOidcIdTokenClaims({
                subjectId: sessionUser.id,
                clientId: client.clientId,
              })
            : {}),
        };
      },
    }),
    twoFactor({ issuer: options.totpIssuer ?? "LAX", allowPasswordless: true }),
    magicLink({
      disableSignUp: true,
      storeToken: "hashed",
      expiresIn: AUTH_TIMINGS.magicLinkExpiresSec,
      sendMagicLink: async ({ email: recipientEmail, token, url }, ctx) => {
        if (!ctx) return;
        const found = await ctx.context.internalAdapter.findUserByEmail(recipientEmail);
        const authUser = found?.user;
        if (!authUser) return;
        const linkedCount = await options.accountLinkReader.countAccountsForUser(authUser.id);
        const template = pickMagicLinkTemplate(linkedCount > 0);
        const linkUrl = resolveMagicLinkUrl({
          pluginUrl: typeof url === "string" ? url : undefined,
          issuerBase,
          webBase,
          token,
        });
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
    buildTwoFactorEnforcementPlugin({ authOrigin: issuerBase }),
    buildPhoneNumberPlugin({
      phoneNumberStore: options.phoneNumberStore,
      phoneVerification,
      email,
    }),
    buildPhoneNumberGuardPlugin(options.phoneNumberStore),
    buildBreachedPasswordPlugin(options.breachedPasswordChecker),
  ];
}
