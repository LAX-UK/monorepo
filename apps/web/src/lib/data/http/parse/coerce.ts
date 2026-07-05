import { toOptionalIsoString } from "@auction/validators";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(Number.NaN);
}

/** Coerce serialized or unknown values to a Date (RSC props, JSON payloads). */
export function coerceToDate(value: unknown): Date {
  return toDate(value);
}

/** ISO 8601 string when `value` is a valid date; otherwise `undefined`. */
export function coerceToIsoString(value: unknown): string | undefined {
  return toOptionalIsoString(value);
}
