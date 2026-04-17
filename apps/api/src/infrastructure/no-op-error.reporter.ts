import type { ClassifiedError, IErrorReporter } from "../services/interfaces/error-handling.js";

export class NoOpErrorReporter implements IErrorReporter {
  report(_classified: ClassifiedError): void {
    // Hook for Sentry/Datadog without coupling the core handler.
  }
}
