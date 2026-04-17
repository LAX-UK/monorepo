import type { Context } from "hono";

export type ErrorSeverity = "info" | "warn" | "error";

export type ClassifiedError = {
  message: string;
  status: number;
  code?: string | undefined;
  severity: ErrorSeverity;
  cause?: unknown;
};

export interface IErrorClassifier {
  classify(error: unknown): ClassifiedError;
}

export interface IErrorLogger {
  log(classified: ClassifiedError): void;
}

export interface IErrorReporter {
  report(classified: ClassifiedError): void;
}

export interface IErrorResponseBuilder {
  build(classified: ClassifiedError): Response;
}

export interface IHttpErrorHandler {
  handle(error: unknown, c: Context): Response;
}
