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
