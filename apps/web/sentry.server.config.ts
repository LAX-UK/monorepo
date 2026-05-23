import * as Sentry from "@sentry/nextjs";
import { createWebSentryOptions } from "./sentry.shared.config.js";

const serverDsn = process.env.SENTRY_DSN_WEB;
if (serverDsn) {
  Sentry.init({
    ...createWebSentryOptions(serverDsn),
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error", "warn"] })],
  });
}
