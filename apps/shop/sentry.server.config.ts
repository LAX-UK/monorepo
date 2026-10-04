import { createShopAppsSentryInitOptions } from "@auction/observability";
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN_SHOP) {
  Sentry.init(createShopAppsSentryInitOptions(process.env.SENTRY_DSN_SHOP));
}
