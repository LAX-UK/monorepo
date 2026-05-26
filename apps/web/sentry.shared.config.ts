import { scrubSentryEvent, shouldDropBrowserExtensionNoise } from "@auction/observability";
import { createSharedSentryInitOptions } from "@auction/observability/sentry-init-options";
import type * as Sentry from "@sentry/nextjs";

export function createWebSentryOptions(dsn: string): Parameters<typeof Sentry.init>[0] {
  const shared = createSharedSentryInitOptions(dsn, {
    tracesSampleRate: 0.05,
    profilesSampleRate: 0.05,
  });
  return {
    ...shared,
    beforeSend: (event, hint) => {
      const scrubbed = scrubSentryEvent(event, hint);
      if (scrubbed === null) return null;
      if (shouldDropBrowserExtensionNoise(scrubbed)) return null;
      return scrubbed;
    },
  };
}
