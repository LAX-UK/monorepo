import { buildTrustedAuthOrigins, createEnvelopeCrypto, parseAuthDekKey } from "@auction/auth";
import { type Database, createDb } from "@auction/db";
import {
  ConsoleEmailService,
  type IEmailService,
  PostmarkEmailService,
  bindEmailQueue,
} from "@auction/email";
import { createDrizzleJwksStore } from "@auction/identity-db";
import { Sentry, getBullMqTelemetry } from "@auction/observability";
import { EMAIL_QUEUE_NAME, createBullQueueOptions } from "@auction/queues";
import {
  ConsolePhoneVerificationService,
  type IPhoneVerificationService,
  TwilioVerifyService,
  isTwilioVerifyConfigured,
} from "@auction/sms";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type pino from "pino";
import type { AuthAppEnv } from "../env.js";
import type { JwksProvider } from "../infrastructure/token-exchange-adapters.js";

export type AuthInfra = {
  db: Database;
  redis: Redis;
  emailQueue: Queue<{ outboxId: string }>;
  emailService: IEmailService;
  webOrigins: string[];
  envelope: { seal(plaintext: string): string; open(sealed: string): string } | undefined;
  jwks: JwksProvider;
  phoneVerification: IPhoneVerificationService;
};

export function createAuthInfra(env: AuthAppEnv, log: pino.Logger): AuthInfra {
  const db = createDb(env.DATABASE_URL_AUTH ?? env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redis.on("error", (err: Error) => {
    log.error({ err }, "redis connection error");
    Sentry.captureException(err);
  });
  const telemetry = getBullMqTelemetry("auction-auth");
  const emailQueue = new Queue<{ outboxId: string }>(
    EMAIL_QUEUE_NAME,
    createBullQueueOptions(EMAIL_QUEUE_NAME, {
      connection: redis,
      ...(telemetry ? { telemetry } : {}),
    }),
  );
  const emailService =
    env.EMAIL_PROVIDER === "postmark"
      ? new PostmarkEmailService(db, bindEmailQueue(emailQueue))
      : new ConsoleEmailService(db, bindEmailQueue(emailQueue));
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
    emailQueue,
    emailService,
    webOrigins,
    envelope,
    jwks: createDrizzleJwksStore(db, envelope),
    phoneVerification:
      env.ENABLE_PHONE_VERIFICATION && isTwilioVerifyConfigured(env)
        ? TwilioVerifyService.fromEnv(env)
        : new ConsolePhoneVerificationService(),
  };
}
