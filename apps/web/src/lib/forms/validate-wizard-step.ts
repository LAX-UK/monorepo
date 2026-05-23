"use client";

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import type { ZodTypeAny } from "zod";

/**
 * Validate one wizard step against the full zod schema, surfacing only issues
 * whose path starts with one of the listed step fields.
 *
 * Why not just `form.trigger(stepFields)`? With a zod resolver, `trigger`
 * applies the resolver to the form-level schema but maps issues only to
 * top-level fields. Cross-field `superRefine` rules whose `path` is a nested
 * key (e.g. `["estimate","high"]`) or whose path lies outside the current
 * step's listed fields slip through, so the user can jump past invalid data.
 *
 * This helper runs the full schema, filters issues by step prefix, sets
 * those errors on the form, and returns whether the step is valid.
 */
export async function validateWizardStep<TSchema extends ZodTypeAny, TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  schema: TSchema,
  stepFields: readonly FieldPath<TValues>[],
): Promise<boolean> {
  if (!stepFields.length) return true;

  const triggerOk = await form.trigger(stepFields, { shouldFocus: true });

  const values = form.getValues();
  const parsed = await schema.safeParseAsync(values);
  if (parsed.success) return triggerOk;

  const stepFieldStrings = stepFields.map((f) => String(f));
  let hadStepIssue = false;
  for (const issue of parsed.error.issues) {
    if (!issue.path.length) continue;
    const head = String(issue.path[0]);
    if (!stepFieldStrings.includes(head)) continue;
    hadStepIssue = true;
    const path = issue.path.map((segment) => String(segment)).join(".");
    form.setError(path as FieldPath<TValues>, {
      type: issue.code,
      message: issue.message,
    });
  }

  return !hadStepIssue && triggerOk;
}
