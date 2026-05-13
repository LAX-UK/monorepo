import { findPostgresError } from "../lib/pg-error.js";
import type { ClassifiedError } from "../services/interfaces/error-handling.js";

function envSafeSchemaMessage(msg: string): string {
  if (process.env.NODE_ENV === "production") {
    return "Database schema is not up to date. Apply pending migrations, then retry.";
  }
  return msg || "Database schema is not up to date.";
}

function envSafeIntegrityMessage(msg: string): string {
  if (process.env.NODE_ENV === "production") {
    return "The request references data that does not exist or is inconsistent.";
  }
  return msg || "Integrity constraint violation.";
}

/** Postgres-specific codes; null when error is not a handled PG case. */
export function tryClassifyPostgres(error: unknown): ClassifiedError | null {
  const pg = findPostgresError(error);
  if (!pg) return null;
  if (pg.code === "42P01") {
    return {
      message: envSafeSchemaMessage(pg.message),
      status: 503,
      code: "database_schema_incomplete",
      severity: "error",
      cause: error,
    };
  }
  if (pg.code === "23503") {
    return {
      message: envSafeIntegrityMessage(pg.message),
      status: 400,
      code: "foreign_key_violation",
      severity: "warn",
      cause: error,
    };
  }
  return null;
}
