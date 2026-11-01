"use client";

import type { ErrorSummaryItem } from "@auction/ui/lax";
import { useEffect } from "react";
import type { FieldErrors, FieldValues, UseFormReturn } from "react-hook-form";

/**
 * The summary's lines, in the order the fields appear on the page. `fieldIds` maps each field name
 * to the id of its control; a field without an id (or without an error) adds no line.
 */
export function summaryItems<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  fieldIds: Readonly<Partial<Record<keyof TFieldValues & string, string>>>,
): ErrorSummaryItem[] {
  const items: ErrorSummaryItem[] = [];
  for (const [name, fieldId] of Object.entries(fieldIds)) {
    const message = (errors as Record<string, { message?: unknown } | undefined>)[name]?.message;
    if (fieldId && typeof message === "string" && message) items.push({ fieldId, message });
  }
  return items;
}

const ERROR_TITLE_PREFIX = "Error: ";

/** "Error: " in front of the page title while the form has errors, put back when they clear. */
export function useErrorPageTitle(hasErrors: boolean): void {
  useEffect(() => {
    if (!hasErrors) return;
    const original = document.title;
    if (!original.startsWith(ERROR_TITLE_PREFIX))
      document.title = `${ERROR_TITLE_PREFIX}${original}`;
    return () => {
      if (document.title.startsWith(ERROR_TITLE_PREFIX)) {
        document.title = document.title.slice(ERROR_TITLE_PREFIX.length);
      }
    };
  }, [hasErrors]);
}

/**
 * The error summary of a form: after the first submit, its invalid fields in page order, a key
 * that changes with every failed submit (so the summary takes focus once per attempt), and the
 * "Error: " page title. Errors clear as each field is fixed, because the summary reads live state.
 */
export function useFormErrorSummary<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  fieldIds: Readonly<Partial<Record<keyof TFieldValues & string, string>>>,
): { errors: ErrorSummaryItem[]; focusKey: number } {
  const { errors, isSubmitted, submitCount } = form.formState;
  const items = isSubmitted ? summaryItems(errors, fieldIds) : [];
  useErrorPageTitle(items.length > 0);
  return { errors: items, focusKey: submitCount };
}
