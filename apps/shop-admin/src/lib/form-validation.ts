/** Field name to a message that reads on its own, since the summary lists it without the label. */
export type FieldErrors = Record<string, string>;

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Keeps only the entries that failed, so callers can list every check in one object literal. */
export function collectFieldErrors(checks: Record<string, string | null>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [name, message] of Object.entries(checks)) {
    if (message) errors[name] = message;
  }
  return errors;
}

export function requiredText(value: string, message: string): string | null {
  return value.trim() ? null : message;
}

/** Parses a whole number in `min..max`; returns the value or the message to show. */
export function parseWholeNumber(
  raw: string,
  bounds: { min: number; max?: number },
  message: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const value = Number(raw);
  const withinMax = bounds.max === undefined || value <= bounds.max;
  if (raw.trim() === "" || !Number.isInteger(value) || value < bounds.min || !withinMax) {
    return { ok: false, message };
  }
  return { ok: true, value };
}
