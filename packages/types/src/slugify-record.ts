/** URL-safe slug for DB unique keys (venues, categories, legal entities, catalog paths). */
export function slugifyRecordKey(value: string, maxLength = 80): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}
