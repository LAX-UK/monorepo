export function isIndexableObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A lot row the API sends for a withdrawn lot: identity only, with the public status
 * "withdrawn". Surfaces that do not render a withdrawn lot skip these rows.
 */
export function isWithdrawnLotRow(value: unknown): boolean {
  return isIndexableObject(value) && value.status === "withdrawn";
}

export function toObjectRecord(value: unknown): { [key: string]: unknown } {
  return isIndexableObject(value) ? value : {};
}
