"use client";

import type { FieldErrorMap } from "@/lib/forms/form-result";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import type { ZodIssue } from "zod";

type StepNavigationOptions<TFieldValues extends FieldValues> = {
  /** Field paths owned by each wizard step (index = step index). */
  stepFields?: readonly (readonly FieldPath<TFieldValues>[])[];
  /** Wizard `goTo` from `onStepControl({ goTo })`. */
  goTo?: (stepIndex: number) => void;
};

export type ZodIssueNavigationOptions<TFieldValues extends FieldValues> =
  StepNavigationOptions<TFieldValues> & {
    /** Tab value → top-level field names owned by that tab. */
    tabFields?: Readonly<Record<string, readonly string[]>>;
    /** Tab `goTo` from `onTabControl({ goTo })`. */
    goToTab?: (tabValue: string) => void;
  };

function zodIssuePathForForm(path: readonly (string | number)[]): string {
  return path.map(String).join(".");
}

function focusFieldAfterNavigation<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  path: FieldPath<TFieldValues>,
): void {
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(() => {
      void form.setFocus(path);
    });
    return;
  }
  void form.setFocus(path);
}

function navigateToOwningSurface<TFieldValues extends FieldValues>(
  firstPath: FieldPath<TFieldValues>,
  options?: ZodIssueNavigationOptions<TFieldValues>,
): void {
  if (!options) return;

  const head = String(firstPath).split(".")[0] ?? "";

  if (options.stepFields && options.goTo) {
    const stepIndex = findOwningStepIndex(options.stepFields, firstPath);
    if (stepIndex >= 0) options.goTo(stepIndex);
    return;
  }

  if (options.tabFields && options.goToTab && head) {
    const tabValue = findOwningTabValue(options.tabFields, head);
    if (tabValue) options.goToTab(tabValue);
  }
}

/** Maps Zod issues onto RHF, navigates to owning step/tab, and focuses the first field. */
export function applyZodIssuesToForm<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  issues: readonly Pick<ZodIssue, "path" | "message">[],
  options?: ZodIssueNavigationOptions<TFieldValues>,
): FieldPath<TFieldValues> | null {
  let firstPath: FieldPath<TFieldValues> | null = null;

  for (const issue of issues) {
    if (!issue.path.length) continue;
    const path = zodIssuePathForForm(issue.path) as FieldPath<TFieldValues>;
    form.setError(path, { type: "manual", message: issue.message });
    if (!firstPath) firstPath = path;
  }

  if (!firstPath) return null;

  navigateToOwningSurface(firstPath, options);
  focusFieldAfterNavigation(form, firstPath);
  return firstPath;
}

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

  navigateToOwningSurface(firstPath, options);
  focusFieldAfterNavigation(form, firstPath);
}

export function findOwningStepIndex<TFieldValues extends FieldValues>(
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

export function findOwningTabValue(
  tabFields: Readonly<Record<string, readonly string[]>>,
  fieldHead: string,
): string | null {
  for (const [tabValue, fields] of Object.entries(tabFields)) {
    if (fields.includes(fieldHead)) return tabValue;
  }
  return null;
}
