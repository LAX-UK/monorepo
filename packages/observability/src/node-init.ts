import * as Sentry from "@sentry/node";
import {
  type SharedSentryInitDefaults,
  createSharedSentryInitOptions,
} from "./sentry-init-options.js";

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
  const defaults: SharedSentryInitDefaults = {};
  if (options.tracesSampleRate !== undefined) {
    defaults.tracesSampleRate = options.tracesSampleRate;
  }
  if (options.profilesSampleRate !== undefined) {
    defaults.profilesSampleRate = options.profilesSampleRate;
  }
  const shared = createSharedSentryInitOptions(options.dsn, defaults);

  Sentry.init({
    ...shared,
    release: options.release ?? shared.release,
    environment: options.environment ?? shared.environment,
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ["error", "warn"] }),
      Sentry.httpIntegration(),
    ],
  });
}

export { Sentry };
