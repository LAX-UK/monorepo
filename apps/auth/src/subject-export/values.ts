/** ISO 8601 in UTC, or null for a missing date. */
export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function isoRequired(date: Date): string {
  return date.toISOString();
}
