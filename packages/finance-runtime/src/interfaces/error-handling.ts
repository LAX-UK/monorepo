export type ErrorSeverity = "info" | "warn" | "error";

export type ClassifiedError = {
  message: string;
  status: number;
  code?: string | undefined;
  severity: ErrorSeverity;
  cause?: unknown;
};

export interface IErrorReporter {
  report(classified: ClassifiedError): void;
}
