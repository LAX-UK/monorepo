/** The strings a failed answer carries as its code: the API sends `error`, the sign-in guard `code`. */
export function errorCodesOf(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  return [record.error, record.code].filter((value): value is string => typeof value === "string");
}

/** The first of a failed answer's codes that `table` knows. */
export function lookupErrorCode<T>(
  body: unknown,
  table: Readonly<Record<string, T>>,
): T | undefined {
  return errorCodesOf(body)
    .map((code) => (Object.hasOwn(table, code) ? table[code] : undefined))
    .find((found) => found !== undefined);
}
