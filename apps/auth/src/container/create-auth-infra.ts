import {
  type EmailSender,
  type SmsSender,
  buildTrustedAuthOrigins,
  createEnvelopeCrypto,
  parseAuthDekKey,
} from "@auction/auth";
import { type Database, createDbFromPool } from "@auction/db";
import {
  type IdentityDb,
  createDrizzleJwksStore,
  createIdentityDb,
  getIdentityPool,
} from "@auction/identity-db";
import { Sentry } from "@auction/observability";
import { Redis } from "ioredis";
import type pino from "pino";
import type { AuthAppEnv } from "../env.js";
import { HttpEmailSender } from "../infrastructure/http-email-sender.js";
import { ConsolePhoneVerificationService } from "../infrastructure/phone-verification/console.service.js";
import {
  TwilioVerifyService,
  isTwilioVerifyConfigured,
} from "../infrastructure/phone-verification/twilio-verify.service.js";
import type { JwksProvider } from "../infrastructure/token-exchange-adapters.js";

export type AuthInfra = {
  db: IdentityDb;
  productDb: Database;
  redis: Redis;
  emailSender: EmailSender;
  webOrigins: string[];
  envelope: { seal(plaintext: string): string; open(sealed: string): string } | undefined;
  jwks: JwksProvider;
  phoneVerification: SmsSender;
};

export function createAuthInfra(env: AuthAppEnv, log: pino.Logger): AuthInfra {
  const db = createIdentityDb(env.DATABASE_URL_AUTH ?? env.DATABASE_URL);
  const productDb = createDbFromPool(getIdentityPool(db));
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redis.on("error", (err: Error) => {
    log.error({ err }, "redis connection error");
    Sentry.captureException(err);
  });
  const emailSender = new HttpEmailSender({
    baseUrl: env.API_INTERNAL_BASE_URL,
    clientId: env.IDENTITY_MACHINE_CLIENT_ID,
    clientSecret: env.IDENTITY_MACHINE_CLIENT_SECRET,
    timeoutMs: env.IDENTITY_EMAIL_ENQUEUE_TIMEOUT_MS,
  });
  const webOrigins = buildTrustedAuthOrigins({
    webOrigin: env.WEB_ORIGIN,
    webOrigins: env.WEB_ORIGINS,
    additionalOrigins: env.SSR_TRUSTED_ORIGINS,
  });
  const envelope =
    env.AUTH_DEK_KEY && env.AUTH_DEK_KEY.trim().length > 0
      ? createEnvelopeCrypto(parseAuthDekKey(env.AUTH_DEK_KEY.trim()))
      : undefined;
  return {
    db,
    productDb,
    redis,
    emailSender,
    webOrigins,
    envelope,
    jwks: createDrizzleJwksStore(db, envelope),
    phoneVerification:
      env.ENABLE_PHONE_VERIFICATION && isTwilioVerifyConfigured(env)
        ? TwilioVerifyService.fromEnv(env)
        : new ConsolePhoneVerificationService(),
  };
}
