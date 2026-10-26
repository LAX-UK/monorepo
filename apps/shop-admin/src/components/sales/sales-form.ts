import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";

type CheckResult = { ok: true } | { ok: false; errors: Partial<Record<string, string>> };

/**
 * A react-hook-form resolver that runs a record check from `sales-records.vm` on the form's
 * values, so one set of rules and messages serves the field errors, the error summary and the
 * request. `fieldOf` maps a check's error key to the form field when the two differ.
 */
export function checkResolver<Values extends FieldValues>(
  check: (values: Values) => CheckResult,
  fieldOf: Partial<Record<string, string>> = {},
): Resolver<Values> {
  return (values) => {
    const result = check(values);
    if (result.ok) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const [key, message] of Object.entries(result.errors)) {
      if (message) errors[fieldOf[key] ?? key] = { type: "validate", message };
    }
    return { values: {}, errors: errors as FieldErrors<Values> };
  };
}

/** The error summary's entries, in the order the fields appear on screen. */
export function summaryOf(
  errors: Partial<Record<string, { message?: string } | undefined>>,
  order: ReadonlyArray<{ field: string; id: string }>,
) {
  return order.flatMap(({ field, id }) => {
    const message = errors[field]?.message;
    return message ? [{ fieldId: id, message }] : [];
  });
}
