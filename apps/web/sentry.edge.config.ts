import * as Sentry from "@sentry/nextjs";
import { createWebSentryOptions } from "./sentry.shared.config.js";

const edgeDsn = process.env.SENTRY_DSN_WEB;
if (edgeDsn) {
  Sentry.init(createWebSentryOptions(edgeDsn));
}
