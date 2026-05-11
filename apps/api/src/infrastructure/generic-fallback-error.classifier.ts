import type { ClassifiedError } from "../services/interfaces/error-handling.js";

function envSafeMessage(msg: string): string {
  if (process.env.NODE_ENV === "production") {
    return "Internal server error";
  }
  return msg || "Internal server error";
}

export function classifyGenericFallback(error: unknown): ClassifiedError {
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
