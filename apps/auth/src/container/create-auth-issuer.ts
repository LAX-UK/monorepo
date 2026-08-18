import { DEFAULT_JWT_AUDIENCE, createAuth, createAuthLifecycleCallbacks } from "@auction/auth";
import { type Database, publishUserRegistered } from "@auction/db";
import { session } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import type { IUserEmailVerifiedPublisher } from "@auction/persistence/interfaces";
import type { IPhoneVerificationService } from "@auction/sms";
import { eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import type pino from "pino";
import type { AuthAppEnv } from "../env.js";
import { adaptOidcClaimsResolver } from "../infrastructure/oidc-claim-resolver-adapter.js";
import type { BackchannelLogoutRevoker } from "../services/backchannel-logout-revocation.service.js";
import type { OidcSessionCoordinator } from "../services/oidc-session-coordinator.js";
import { publishIdentityProfileUpdated } from "../services/publish-identity-profile-updated.js";
import { publishUserEmailVerified } from "../services/publish-user-email-verified.js";

export function createAuthIssuer(options: {
  env: AuthAppEnv;
  db: Database;
  redis: Redis;
  log: pino.Logger;
  email: IEmailService;
  phoneVerification: IPhoneVerificationService;
  trustedOrigins: string[];
  logout: BackchannelLogoutRevoker;
  oidcSessions: Pick<OidcSessionCoordinator, "resolveIdTokenClaims">;
  userEmailVerifiedPublisher: IUserEmailVerifiedPublisher;
}): ReturnType<typeof createAuth> {
  const lifecycle = createAuthLifecycleCallbacks({
    markUserForOAuthAttribution: (userId) =>
      options.redis
        .set(`marketing:new-user:${userId}`, "1", "EX", 30 * 60, "NX")
        .then(() => undefined),
    completeOAuthAttribution: async ({ userId, providerId }) => {
      await options.redis.eval(
        `
          if redis.call("EXISTS", KEYS[1]) ~= 1 then return 0 end
          redis.call("DEL", KEYS[1])
          if ARGV[1] == "google" or ARGV[1] == "apple" then
            redis.call("SET", KEYS[2], ARGV[1], "EX", ARGV[2], "NX")
            return 1
          end
          return 0
        `,
        2,
        `marketing:new-user:${userId}`,
        `marketing:oauth-signup:${userId}`,
        providerId,
        30 * 60,
      );
    },
    publishUserRegisteredForAccount: async ({ userId }) => {
      const user = await options.db.query.user.findFirst({
        where: (users, { eq: equals }) => equals(users.id, userId),
        columns: { id: true, email: true, name: true },
      });
      if (!user)
        throw new Error(`Cannot publish user.registered: auth user ${userId} was not found`);
      await publishUserRegistered(
        options.db,
        { userId: user.id, name: user.name, email: user.email },
        { producer: "apps/auth" },
      );
    },
    publishUserEmailVerified: (user) =>
      publishUserEmailVerified(options.userEmailVerifiedPublisher, {
        userId: user.id,
        email: user.email,
      }),
    onNonBlockingError: (_stage, error, userId) => {
      options.log.error({ error, userId }, "failed to mark new user for OAuth attribution");
    },
  });
  const env = options.env;
  return createAuth({
    db: options.db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.OIDC_ISSUER_URL,
    issuerURL: env.OIDC_ISSUER_URL,
    trustedOrigins: options.trustedOrigins,
    allowInsecureCookies: env.ALLOW_HTTP_COOKIES,
    webOrigin: env.WEB_ORIGIN,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    appleClientId: env.APPLE_CLIENT_ID,
    appleClientSecret: env.APPLE_CLIENT_SECRET,
    email: options.email,
    phoneVerification: options.phoneVerification,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    jwtAudience: env.JWT_AUDIENCE ?? DEFAULT_JWT_AUDIENCE,
    authDekKey: env.AUTH_DEK_KEY?.trim(),
    revokeAllSessions: async (userId) => {
      await options.logout.revokeSubject(userId);
      const rows = await options.db
        .delete(session)
        .where(eq(session.userId, userId))
        .returning({ id: session.id });
      return rows.length;
    },
    ...lifecycle,
    onUserUpdated: (user) =>
      publishIdentityProfileUpdated(options.db, {
        subjectId: user.id,
        email: user.email,
        name: user.name,
        phone: user.phoneNumber ?? null,
      }),
    enableNewDeviceLoginEmail: env.NODE_ENV === "production",
    resolveOidcIdTokenClaims: adaptOidcClaimsResolver((input) =>
      options.oidcSessions.resolveIdTokenClaims(input),
    ),
  });
}
