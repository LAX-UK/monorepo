/** Walk `cause` chains (Drizzle, etc.) for a Postgres `code` on Error instances. */

const PG_CODE_RE = /^[0-9A-Z]{5}$/;

export type PgErrorInfo = { code: string; message: string };

export function findPostgresError(error: unknown): PgErrorInfo | null {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && PG_CODE_RE.test(code)) {
        return { code, message: current.message };
      }
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}
