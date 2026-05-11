import { ZodError } from "zod";
import { AuthzError, BidError, LotError } from "../lib/errors.js";
import type { ClassifiedError, ErrorSeverity } from "../services/interfaces/error-handling.js";

function severityForStatus(status: number): ErrorSeverity {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

/** Bid/Lot/Authz/Zod — returns null when not applicable (chain next). */
export function tryClassifyDomainValidation(error: unknown): ClassifiedError | null {
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
  return null;
}
