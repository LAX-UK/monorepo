import { type Auth, DEFAULT_JWT_AUDIENCE, createAuth } from "@auction/auth/server";
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
import { trustedWebOrigins } from "../lib/trusted-origins.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
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
};

export function createContainerAuth(input: CreateAuthInput): ContainerAuth {
  const { env, db, authDb, emailService, sessionRevocation, ensurePersonalLegalEntityService } =
    input;

  const phoneVerification: IPhoneVerificationService =
    env.ENABLE_PHONE_VERIFICATION && isTwilioVerifyConfigured(env)
      ? TwilioVerifyService.fromEnv(env)
      : new ConsolePhoneVerificationService();

  const auth = createAuth({
    db: authDb,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.API_PUBLIC_URL,
    issuerURL: env.OIDC_ISSUER_URL,
    trustedOrigins: trustedWebOrigins(env),
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
    onUserCreated: async (authUser) => {
      await ensurePersonalLegalEntityService.ensure({
        userId: authUser.id,
        displayName: authUser.name,
        email: authUser.email,
      });
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
    onEmailVerified: async (authUser) => {
      const { publishUserEmailVerified } = await import(
        "../services/publish-user-email-verified.js"
      );
      const publisher = new DrizzleUserEmailVerifiedPublisher(db);
      await publishUserEmailVerified(publisher, {
        userId: authUser.id,
        email: authUser.email,
      });
    },
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
