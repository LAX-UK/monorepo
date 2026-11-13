"use client";

import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { useCallback, useState, useTransition } from "react";
import type { DefaultValues, FieldValues, Resolver, UseFormProps } from "react-hook-form";
import { useForm } from "react-hook-form";

type ActionFormOptions<TFieldValues extends FieldValues, TData> = {
  /**
   * The form's check: `zodFormResolver(schema, errorMap)`, or a `lazyResolver` on public pages so
   * the schema and Zod load with the form's first check instead of in the page's first scripts.
   */
  resolver: Resolver<TFieldValues>;
  defaultValues: DefaultValues<TFieldValues>;
  action: (values: TFieldValues) => Promise<ActionResult<TData>>;
  onSuccess?: (data: TData | undefined) => void;
  successToast?: { title: string; description?: string };
  formOptions?: Omit<UseFormProps<TFieldValues>, "defaultValues" | "resolver">;
  /**
   * Whether a failed action also raises a toast (default). A form that shows the failure in its
   * own notice sets this to false so the message is not said twice.
   */
  toastFailure?: boolean;
  /** Whether a server field error moves focus to its field (default). False with an error summary. */
  focusInvalidField?: boolean;
};

/** RHF + server action: runs the action in a transition, maps `ActionResult` field errors to the form.
 */
export function useActionForm<TFieldValues extends FieldValues, TData = void>({
  resolver,
  defaultValues,
  action,
  onSuccess,
  successToast,
  formOptions,
  toastFailure = true,
  focusInvalidField = true,
}: ActionFormOptions<TFieldValues, TData>) {
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);
  const form = useForm<TFieldValues>({
    ...formOptions,
    resolver,
    defaultValues,
  });

  const runAction = useCallback(
    (values: TFieldValues) => {
      setRootError(null);
      startTransition(() => {
        void (async () => {
          const r = await action(values);
          if (r.ok) {
            if (successToast) {
              notify.success(successToast.title, {
                ...(successToast.description !== undefined
                  ? { description: successToast.description }
                  : {}),
              });
            }
            onSuccess?.(r.data);
            return;
          }
          if (r.fieldErrors) {
            applyActionFieldErrors(form, r.fieldErrors, { focusField: focusInvalidField });
          }
          setRootError(r.error);
          if (toastFailure) notify.error(r.error);
        })();
      });
    },
    [action, onSuccess, successToast, form, toastFailure, focusInvalidField],
  );

  const onSubmit = form.handleSubmit((values) => {
    runAction(values);
  });

  return {
    form,
    onSubmit,
    isSubmitting: isPending || form.formState.isSubmitting,
    rootError,
  };
}
