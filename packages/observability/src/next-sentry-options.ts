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
      if (shouldDropUnactionableRedactedRscClientError(enriched)) return null;
      return enriched;
    },
  };
}
