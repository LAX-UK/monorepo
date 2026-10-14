import { createNextSentryOptions } from "@auction/observability/next-sentry-options";
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN_ART) {
  Sentry.init(createNextSentryOptions(process.env.SENTRY_DSN_ART));
}
