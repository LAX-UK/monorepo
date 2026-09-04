import {
  type EmailSender,
  type ProductSubjectUsageProbe,
  type SmsSender,
  buildTrustedAuthOrigins,
  createEnvelopeCrypto,
  parseAuthDekKey,
} from "@auction/auth";
import { type IdentityDb, createDrizzleJwksStore, createIdentityDb } from "@auction/identity-db";
import { Sentry } from "@auction/observability";
import { Redis } from "ioredis";
import type pino from "pino";
import type { AuthAppEnv } from "../env.js";
import { HttpEmailSender } from "../infrastructure/http-email-sender.js";
import { HttpProductSubjectUsageProbe } from "../infrastructure/http-product-subject-usage-probe.js";
import type { JwksProvider } from "../infrastructure/jwks-provider.js";
import { ConsolePhoneVerificationService } from "../infrastructure/phone-verification/console.service.js";
import {
  TwilioVerifyService,
  isTwilioVerifyConfigured,
} from "../infrastructure/phone-verification/twilio-verify.service.js";

export type AuthInfra = {
  db: IdentityDb;
  redis: Redis;
  emailSender: EmailSender;
  productSubjectUsage: ProductSubjectUsageProbe;
  webOrigins: string[];
  envelope: { seal(plaintext: string): string; open(sealed: string): string } | undefined;
  jwks: JwksProvider;
  phoneVerification: SmsSender;
};

export function createAuthInfra(env: AuthAppEnv, log: pino.Logger): AuthInfra {
  const db = createIdentityDb(env.DATABASE_URL_AUTH ?? env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redis.on("error", (err: Error) => {
    log.error({ err }, "redis connection error");
    Sentry.captureException(err);
  });
  const emailBaseUrl = env.IDENTITY_EMAIL_ENQUEUE_URL ?? env.API_INTERNAL_BASE_URL;
  const usageBaseUrl = env.IDENTITY_PRODUCT_USAGE_URL ?? env.API_INTERNAL_BASE_URL;
  const emailSender = new HttpEmailSender({
    baseUrl: emailBaseUrl,
    clientId: env.IDENTITY_MACHINE_CLIENT_ID,
    clientSecret: env.IDENTITY_MACHINE_CLIENT_SECRET,
    timeoutMs: env.IDENTITY_EMAIL_ENQUEUE_TIMEOUT_MS,
  });
  const productSubjectUsage = new HttpProductSubjectUsageProbe({
    baseUrl: usageBaseUrl,
    clientId: env.IDENTITY_MACHINE_CLIENT_ID,
    clientSecret: env.IDENTITY_MACHINE_CLIENT_SECRET,
    timeoutMs: env.IDENTITY_SUBJECT_USAGE_TIMEOUT_MS,
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
    redis,
    emailSender,
    productSubjectUsage,
    webOrigins,
    envelope,
    jwks: createDrizzleJwksStore(db, envelope),
    phoneVerification:
      env.ENABLE_PHONE_VERIFICATION && isTwilioVerifyConfigured(env)
        ? TwilioVerifyService.fromEnv(env)
        : new ConsolePhoneVerificationService(),
  };
}
