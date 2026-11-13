import * as Sentry from "@sentry/nextjs";
import { createWebClientSentryOptions } from "./src/lib/observability/sentry-client-options";

const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;
if (clientDsn) {
  Sentry.init(createWebClientSentryOptions(clientDsn, window.location.pathname));
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
