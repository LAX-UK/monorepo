import * as Sentry from "@sentry/node";
import {
  readSampleRate,
  resolveSentryEnvironment,
  scrubSentryEvent,
  sentryTracesSampler,
} from "./sentry-shared.js";

export type NodeSentryInitOptions = {
  dsn: string;
  appEnv?: string;
  nodeEnv?: string;
  release?: string;
  environment?: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
};

export function initNodeSentry(options: NodeSentryInitOptions): void {
  const tracesSampleRate = readSampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
    options.tracesSampleRate ?? 0.1,
  );
  const profilesSampleRate = readSampleRate(
    process.env.SENTRY_PROFILES_SAMPLE_RATE,
    options.profilesSampleRate ?? 0,
  );

  Sentry.init({
    dsn: options.dsn,
    release: options.release ?? process.env.SENTRY_RELEASE,
    environment:
      options.environment ??
      process.env.SENTRY_ENVIRONMENT ??
      resolveSentryEnvironment(options.appEnv, options.nodeEnv),
    tracesSampleRate,
    profilesSampleRate,
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ["error", "warn"] }),
      Sentry.httpIntegration(),
    ],
    tracesSampler: (ctx) => sentryTracesSampler(ctx, tracesSampleRate),
    beforeSend: scrubSentryEvent,
  });
}

export { Sentry };
