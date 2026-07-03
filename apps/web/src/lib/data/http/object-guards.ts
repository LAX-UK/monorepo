export function isIndexableObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toObjectRecord(value: unknown): { [key: string]: unknown } {
  return isIndexableObject(value) ? value : {};
}
