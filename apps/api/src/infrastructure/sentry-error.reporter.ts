import * as Sentry from "@sentry/node";
import type { ClassifiedError, IErrorReporter } from "../services/interfaces/error-handling.js";

/** Sends classified API errors to Sentry when DSN is configured (see `index.ts` Sentry.init). */
export class SentryErrorReporter implements IErrorReporter {
  report(classified: ClassifiedError): void {
    const tags: Record<string, string> = {
      http_status: String(classified.status),
    };
    if (classified.code) tags.error_code = classified.code;

    if (classified.cause instanceof Error) {
      Sentry.captureException(classified.cause, {
        tags,
        extra: { classifiedMessage: classified.message },
      });
      return;
    }

    Sentry.captureMessage(classified.message, {
      level: "error",
      tags,
      extra: { cause: classified.cause },
    });
  }
}
