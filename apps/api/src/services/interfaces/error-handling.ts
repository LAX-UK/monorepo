import type { Context } from "hono";

import type { ClassifiedError } from "@auction/finance-runtime";

export type { ClassifiedError, ErrorSeverity, IErrorReporter } from "@auction/finance-runtime";

export interface IErrorClassifier {
  classify(error: unknown): ClassifiedError;
}

export interface IErrorLogger {
  log(classified: ClassifiedError): void;
}

export interface IErrorResponseBuilder {
  build(classified: ClassifiedError): Response;
}

export interface IHttpErrorHandler {
  handle(error: unknown, c: Context): Response;
}
