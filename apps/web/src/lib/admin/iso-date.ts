/**
 * An ISO timestamp from a value typed as a Date. Records that come through the API are JSON, so
 * their dates arrive as strings even where the shared type says Date.
 */
export function isoDate(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** As `isoDate`, keeping a missing value missing. */
export function isoDateOrNull(value: Date | string | null | undefined): string | null {
  return value == null ? null : isoDate(value);
}
