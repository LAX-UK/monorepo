import { createNextSentryOptions } from "@auction/observability/next-sentry-options";
import type * as Sentry from "@sentry/nextjs";

export function createWebSentryOptions(dsn: string): Parameters<typeof Sentry.init>[0] {
  return createNextSentryOptions(dsn);
}
