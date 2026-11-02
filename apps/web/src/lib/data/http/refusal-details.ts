/**
 * The facts a typed refusal carries (the new next bid, the nearest valid amount, the room left),
 * read off an error body. Anything that isn't a plain string is left out, so a malformed body is
 * the same as none.
 */
export function parseRefusalDetails(raw: unknown): Readonly<Record<string, string>> | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") details[key] = value;
  }
  return Object.keys(details).length > 0 ? details : undefined;
}
