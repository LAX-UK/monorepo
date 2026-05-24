import type { ErrorEvent, EventHint, SamplingContext } from "@sentry/core";
import { resolveSentryEnvironmentFromEnv } from "./sentry-env.js";
import {
  readSampleRate,
  scrubSentryEvent,
  scrubSentryTransaction,
  sentryTracesSampler,
} from "./sentry-shared.js";

export type SharedSentryInitDefaults = {
  tracesSampleRate?: number;
  profilesSampleRate?: number;
};

/** SDK init fields shared by Node and Next.js runtimes. */
export function createSharedSentryInitOptions(
  dsn: string,
  defaults: SharedSentryInitDefaults = {},
): {
  dsn: string;
  release: string | undefined;
  environment: string;
  sendDefaultPii: false;
  tracesSampleRate: number;
  profilesSampleRate: number;
  tracesSampler: (ctx: SamplingContext) => number;
  beforeSend: <T extends ErrorEvent>(event: T, hint?: EventHint) => T;
  beforeSendTransaction: typeof scrubSentryTransaction;
} {
  const tracesSampleRate = readSampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
    defaults.tracesSampleRate ?? 0.1,
  );
  const profilesSampleRate = readSampleRate(
    process.env.SENTRY_PROFILES_SAMPLE_RATE,
    defaults.profilesSampleRate ?? 0,
  );

  return {
    dsn,
    release: process.env.SENTRY_RELEASE,
    environment: resolveSentryEnvironmentFromEnv(),
    sendDefaultPii: false,
    tracesSampleRate,
    profilesSampleRate,
    tracesSampler: (ctx) => sentryTracesSampler(ctx, tracesSampleRate),
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryTransaction,
  };
}
