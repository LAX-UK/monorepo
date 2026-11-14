import type { ErrorEvent, EventHint } from "@sentry/core";
import {
  enrichSentryEventWithNextDigest,
  shouldDropUnactionableRedactedRscClientError,
} from "./next-error-digest.js";
import { createSharedSentryInitOptions } from "./sentry-init-options.js";
import {
  scrubSentryEvent,
  shouldDropBrowserExtensionNoise,
  shouldDropThirdPartyClientNoise,
  shouldDropUnparsableScriptNoise,
} from "./sentry-shared.js";

/** `Sentry.init` options for a Next.js storefront (server, edge and browser runtimes). */
export function createNextSentryOptions(dsn: string) {
  const shared = createSharedSentryInitOptions(dsn, {
    tracesSampleRate: 0.05,
    profilesSampleRate: 0.05,
  });
  return {
    ...shared,
    beforeSend: (event: ErrorEvent, hint?: EventHint): ErrorEvent | null => {
      const scrubbed = scrubSentryEvent(event, hint);
      if (scrubbed === null) return null;
      const enriched = enrichSentryEventWithNextDigest(scrubbed, hint);
      if (shouldDropBrowserExtensionNoise(enriched)) return null;
      if (shouldDropThirdPartyClientNoise(enriched)) return null;
      if (shouldDropUnparsableScriptNoise(enriched)) return null;
      if (shouldDropUnactionableRedactedRscClientError(enriched)) return null;
      return enriched;
    },
  };
}

/** Name of the browser performance tracing integration in the Sentry SDK. */
export const BROWSER_TRACING_INTEGRATION = "BrowserTracing";

type NamedIntegration = { name: string };

/**
 * Browser `Sentry.init` options that report errors only: the same scrubbing `beforeSend` as
 * {@link createNextSentryOptions}, but no sample rates and no tracing integration, so no
 * transactions are sent and the tracing code is not started.
 */
export function createNextBrowserErrorOptions(dsn: string) {
  const { tracesSampleRate, profilesSampleRate, tracesSampler, beforeSendTransaction, ...rest } =
    createNextSentryOptions(dsn);
  return {
    ...rest,
    integrations: <T extends NamedIntegration>(defaults: T[]): T[] =>
      defaults.filter((integration) => integration.name !== BROWSER_TRACING_INTEGRATION),
  };
}
