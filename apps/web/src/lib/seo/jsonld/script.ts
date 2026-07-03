/** Safe inline JSON-LD for `<script type="application/ld+json">` (escapes `<`). */
export function jsonLdScript(...items: Array<Record<string, unknown> | null | undefined>): string {
  const payload = items.filter(Boolean) as Record<string, unknown>[];
  const json =
    payload.length === 0
      ? "{}"
      : payload.length === 1
        ? JSON.stringify(payload[0])
        : JSON.stringify(payload);
  return json.replace(/</g, "\\u003c");
}
