import {
  readSampleRate,
  resolveSentryEnvironment,
  scrubSentryEvent,
  sentryTracesSampler,
} from "@auction/observability";
import type * as Sentry from "@sentry/nextjs";

export function createWebSentryOptions(dsn: string): Parameters<typeof Sentry.init>[0] {
  const tracesSampleRate = readSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.05);
  return {
    dsn,
    release: process.env.SENTRY_RELEASE,
    environment: resolveSentryEnvironment(process.env.APP_ENV, process.env.NODE_ENV),
    tracesSampleRate,
    profilesSampleRate: readSampleRate(process.env.SENTRY_PROFILES_SAMPLE_RATE, 0.05),
    tracesSampler: (ctx) => sentryTracesSampler(ctx, tracesSampleRate),
    beforeSend: scrubSentryEvent,
  };
}
