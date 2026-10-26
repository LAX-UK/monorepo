"use client";

import { staffFormSummaryErrors } from "@/components/admin/forms/staff-form-fields";
import { type UnsavedChangesState, useUnsavedChanges } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
  useForm,
} from "react-hook-form";

type Options<T extends FieldValues> = {
  resolver: Resolver<T>;
  defaultValues: DefaultValues<T>;
  /** The form's id: prefixes every control's id, so the error summary can link to them. */
  formId: string;
  /** Field names in the order they appear, which orders the error summary. */
  fieldOrder: readonly string[];
  /** What is being edited, for "Discard changes to <label>?". */
  label?: string;
  /** Nothing can be saved (a read-only record), so there is nothing to guard. */
  readOnly?: boolean;
};

export type StaffFormState<T extends FieldValues> = {
  form: UseFormReturn<T>;
  guard: UnsavedChangesState;
  /** What to fix after a failed submit, linking to each field. */
  summary: Array<{ fieldId: string; message: string }>;
  /** A failure that belongs to the whole form (the API refused the save). */
  formError: string | null;
  setFormError: (message: string | null) => void;
  /** Failed and successful submits so far; the error summary takes focus on each change. */
  submitCount: number;
  /**
   * Counts what is typed as saved. It resets to the form as typed, not to the server's parsed
   * copy, which drops empty fields and would read as changed again.
   */
  markSaved: () => void;
  /** Leaves the form after a save without the unsaved-changes question. */
  leave: (href: string) => Promise<void>;
};

/**
 * The staff form conventions in one place: validate on submit, then again as each field changes;
 * the error summary (not the first field) takes focus after a failed submit; leaving with changes
 * asks first; a save the API refuses stays on the form.
 */
export function useStaffForm<T extends FieldValues>({
  resolver,
  defaultValues,
  formId,
  fieldOrder,
  label,
  readOnly = false,
}: Options<T>): StaffFormState<T> {
  const router = useRouter();
  const form = useForm<T>({
    resolver,
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const guard = useUnsavedChanges(form.formState.isDirty && !readOnly, {
    navigate: (href) => router.push(href),
    ...(label ? { label } : {}),
  });
  const markSaved = useCallback(() => form.reset(form.getValues()), [form]);
  const leave = useCallback(
    async (href: string) => {
      await guard.release();
      router.push(href);
    },
    [guard, router],
  );
  return {
    form,
    guard,
    summary: staffFormSummaryErrors(form.formState.errors, formId, fieldOrder),
    formError,
    setFormError,
    submitCount: form.formState.submitCount,
    markSaved,
    leave,
  };
}
