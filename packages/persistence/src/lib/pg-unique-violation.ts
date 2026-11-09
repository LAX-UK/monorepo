const MAX_CAUSE_DEPTH = 8;

/**
 * True when the error, or anything on its `cause` chain, is a Postgres unique violation (23505).
 * Drizzle wraps the driver error, so the SQLSTATE usually sits on `.cause` rather than the top.
 */
export function isPgUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * The name of the unique index or constraint a violation (23505) hit, or `null` for any other
 * error. It lets a caller tell "this key was used before" from "this lot is already booked".
 */
export function pgUniqueViolationConstraint(err: unknown): string | null {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (code === "23505") return typeof constraint === "string" ? constraint : null;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}
