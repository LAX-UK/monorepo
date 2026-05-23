"use client";

import type { FieldErrorMap } from "@/lib/forms/form-result";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

type StepNavigationOptions<TFieldValues extends FieldValues> = {
  /** Field paths owned by each wizard step (index = step index). */
  stepFields?: readonly (readonly FieldPath<TFieldValues>[])[];
  /** Wizard `goTo` from `onStepControl({ goTo })`. */
  goTo?: (stepIndex: number) => void;
};

/** Maps server `fieldErrors` onto RHF and focuses the first invalid field.
 *
 * When the form is rendered inside a multi-step wizard, pass `stepFields` and
 * `goTo` so the wizard navigates to the step that owns the first invalid
 * field. Without this the user sees a toast but the offending field is not on
 * the active step → `setFocus` is a no-op and they have no visual cue.
 */
export function applyActionFieldErrors<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  fieldErrors: FieldErrorMap,
  options?: StepNavigationOptions<TFieldValues>,
): void {
  let firstPath: FieldPath<TFieldValues> | null = null;

  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (!messages?.length) continue;
    const msg = messages[0];
    if (msg == null) continue;
    const name = (key === "root" ? "root" : key) as FieldPath<TFieldValues>;
    form.setError(name, { type: "server", message: msg });
    if (!firstPath && key !== "root") {
      firstPath = name;
    }
  }

  if (!firstPath) return;

  if (options?.stepFields && options.goTo) {
    const stepIndex = findOwningStepIndex(options.stepFields, firstPath);
    if (stepIndex >= 0) options.goTo(stepIndex);
  }

  void form.setFocus(firstPath);
}

function findOwningStepIndex<TFieldValues extends FieldValues>(
  stepFields: readonly (readonly FieldPath<TFieldValues>[])[],
  path: FieldPath<TFieldValues>,
): number {
  const head = String(path).split(".")[0];
  for (let i = 0; i < stepFields.length; i++) {
    const fields = stepFields[i];
    if (!fields) continue;
    for (const f of fields) {
      if (String(f) === head) return i;
    }
  }
  return -1;
}
