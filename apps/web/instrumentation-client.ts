import * as Sentry from "@sentry/nextjs";
import { createWebSentryOptions } from "./sentry.shared.config";

const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;
if (clientDsn) {
  Sentry.init(createWebSentryOptions(clientDsn));
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
