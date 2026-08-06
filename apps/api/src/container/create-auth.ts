import {
  type Auth,
  DEFAULT_JWT_AUDIENCE,
  buildTrustedAuthOrigins,
  createAuth,
  createAuthLifecycleCallbacks,
} from "@auction/auth/server";
import { publishUserRegistered } from "@auction/db";
import type { Database } from "@auction/db";
import type { IEmailService } from "@auction/email";
import { DrizzleUserEmailVerifiedPublisher } from "@auction/persistence/repositories";
import {
  ConsolePhoneVerificationService,
  type IPhoneVerificationService,
  TwilioVerifyService,
  isTwilioVerifyConfigured,
} from "@auction/sms";
import type { Env } from "../env.js";
import { BetterAuthAuthenticator } from "../infrastructure/better-auth-authenticator.js";
import { CompositeAuthenticator } from "../infrastructure/composite-authenticator.js";
import { JwtAuthenticator } from "../infrastructure/jwt-authenticator.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { IOAuthAttributionStore } from "../services/interfaces/oauth-attribution-store.js";
import type { EnsurePersonalLegalEntityService } from "../services/legal-entity/ensure-personal-legal-entity.service.js";
import type { SessionRevocationService } from "../services/session-revocation.service.js";

export type ContainerAuth = {
  auth: Auth;
  authenticator: IAuthenticator;
};

export type CreateAuthInput = {
  env: Env;
  db: Database;
  authDb: Database;
  emailService: IEmailService;
  sessionRevocation: SessionRevocationService;
  ensurePersonalLegalEntityService: EnsurePersonalLegalEntityService;
  oauthAttributionStore: IOAuthAttributionStore;
};

export function createContainerAuth(input: CreateAuthInput): ContainerAuth {
  const {
    env,
    db,
    authDb,
    emailService,
    sessionRevocation,
    ensurePersonalLegalEntityService,
    oauthAttributionStore,
  } = input;

  const phoneVerification: IPhoneVerificationService =
    env.ENABLE_PHONE_VERIFICATION && isTwilioVerifyConfigured(env)
      ? TwilioVerifyService.fromEnv(env)
      : new ConsolePhoneVerificationService();

  const lifecycle = createAuthLifecycleCallbacks({
    markUserForOAuthAttribution: (userId) => oauthAttributionStore.markNewUser(userId),
    ensurePersonalLegalEntity: (authUser) =>
      ensurePersonalLegalEntityService.ensure({
        userId: authUser.id,
        displayName: authUser.name,
        email: authUser.email,
      }),
    publishUserRegisteredForAccount: async ({ userId }) => {
      const authUser = await authDb.query.user.findFirst({
        where: (users, { eq }) => eq(users.id, userId),
        columns: { id: true, email: true, name: true },
      });
      if (!authUser) {
        throw new Error(`Cannot publish user.registered: auth user ${userId} was not found`);
      }
      await publishUserRegistered(
        db,
        {
          userId: authUser.id,
          email: authUser.email,
          name: authUser.name,
        },
        { producer: "apps/api", accountDb: authDb },
      );
    },
    completeOAuthAttribution: ({ userId, providerId }) =>
      oauthAttributionStore.completeNewUserAccount(userId, providerId),
    publishUserEmailVerified: async (authUser) => {
      const { publishUserEmailVerified } = await import(
        "../services/publish-user-email-verified.js"
      );
      const publisher = new DrizzleUserEmailVerifiedPublisher(db);
      await publishUserEmailVerified(publisher, {
        userId: authUser.id,
        email: authUser.email,
      });
    },
    onNonBlockingError: (_stage, error, userId) => {
      console.error("[marketing] failed to mark new user for OAuth attribution", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const auth = createAuth({
    db: authDb,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.API_PUBLIC_URL,
    issuerURL: env.OIDC_ISSUER_URL,
    trustedOrigins: buildTrustedAuthOrigins({
      webOrigin: env.WEB_ORIGIN,
      webOrigins: env.WEB_ORIGINS,
      additionalOrigins: env.SSR_TRUSTED_ORIGINS,
    }),
    allowInsecureCookies: env.ALLOW_HTTP_COOKIES,
    cookieDomain: env.COOKIE_DOMAIN,
    webOrigin: env.WEB_ORIGIN,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    appleClientId: env.APPLE_CLIENT_ID,
    appleClientSecret: env.APPLE_CLIENT_SECRET,
    email: emailService,
    phoneVerification,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    jwtAudience: env.JWT_AUDIENCE ?? DEFAULT_JWT_AUDIENCE,
    authDekKey: env.AUTH_DEK_KEY?.trim(),
    revokeAllSessions: (userId: string) => sessionRevocation.revokeAllForUser(userId),
    ...lifecycle,
    enableNewDeviceLoginEmail: env.NODE_ENV === "production",
  });

  const issuer = env.OIDC_ISSUER_URL ?? env.API_PUBLIC_URL;
  const authenticator: IAuthenticator = new CompositeAuthenticator([
    new BetterAuthAuthenticator(auth),
    new JwtAuthenticator({
      issuer,
      jwksUrl: `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`,
      audience: env.JWT_AUDIENCE ?? DEFAULT_JWT_AUDIENCE,
    }),
  ]);

  return { auth, authenticator };
}
