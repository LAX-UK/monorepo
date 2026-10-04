import { createSharedSentryInitOptions } from "@auction/observability/sentry-init-options";
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN_SHOP) {
  Sentry.init(createSharedSentryInitOptions(process.env.SENTRY_DSN_SHOP));
}
