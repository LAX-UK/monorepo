import * as Sentry from "@sentry/nextjs";
import {
  createWebClientSentryOptions,
  enableBrowserTracingOnNavigation,
} from "./src/lib/observability/sentry-client-options";

const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;
if (clientDsn) {
  Sentry.init(createWebClientSentryOptions(clientDsn, window.location.pathname));
}

/**
 * Starts the navigation span. A session that began on a public page has no tracing until it
 * navigates into the account or staff area; tracing is turned on first, so that navigation is
 * traced too.
 */
export function onRouterTransitionStart(
  ...args: Parameters<typeof Sentry.captureRouterTransitionStart>
): void {
  enableBrowserTracingOnNavigation(Sentry.getClient(), args[0], () =>
    Sentry.browserTracingIntegration({ instrumentPageLoad: false }),
  );
  Sentry.captureRouterTransitionStart(...args);
}
