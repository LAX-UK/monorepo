import { ZodError } from "zod";
import { AuthzError, BidError, LotError } from "../lib/errors.js";
import type {
  ClassifiedError,
  ErrorSeverity,
  IErrorClassifier,
} from "../services/interfaces/error-handling.js";

function severityForStatus(status: number): ErrorSeverity {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

export class DefaultErrorClassifier implements IErrorClassifier {
  classify(error: unknown): ClassifiedError {
    if (error instanceof BidError) {
      return {
        message: error.message,
        status: error.status,
        code: "BidError",
        severity: severityForStatus(error.status),
        cause: error,
      };
    }
    if (error instanceof LotError) {
      return {
        message: error.message,
        status: error.status,
        code: "LotError",
        severity: severityForStatus(error.status),
        cause: error,
      };
    }
    if (error instanceof AuthzError) {
      return {
        message: error.message,
        status: error.status,
        code: "AuthzError",
        severity: "warn",
        cause: error,
      };
    }
    if (error instanceof ZodError) {
      return {
        message: "Validation failed",
        status: 400,
        code: "ValidationError",
        severity: "warn",
        cause: error,
      };
    }
    if (error instanceof Error) {
      return {
        message: envSafeMessage(error.message),
        status: 500,
        code: "InternalError",
        severity: "error",
        cause: error,
      };
    }
    return {
      message: "Internal server error",
      status: 500,
      code: "UnknownError",
      severity: "error",
      cause: error,
    };
  }
}

function envSafeMessage(msg: string): string {
  if (process.env.NODE_ENV === "production") {
    return "Internal server error";
  }
  return msg || "Internal server error";
}
