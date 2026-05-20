import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

/** Map a Zod issue to a react-hook-form field error. */
export function applyZodErrorsToForm<T extends FieldValues>(
  form: UseFormReturn<T>,
  path: FieldPath<T> | string,
  message: string,
): void {
  form.setError(path as FieldPath<T>, { type: "manual", message });
}

/** Convert Zod path segments to a dot-joined field path for nested forms. */
export function zodIssuePathForForm(path: (string | number)[]): string {
  return path.map(String).join(".");
}
