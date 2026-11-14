import { createNextBrowserErrorOptions } from "@auction/observability/next-sentry-options";
import * as Sentry from "@sentry/nextjs";

/** Inlined at build time from the image build arg; unset leaves the browser SDK off. */
const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN;
if (clientDsn) {
  Sentry.init(createNextBrowserErrorOptions(clientDsn));
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
