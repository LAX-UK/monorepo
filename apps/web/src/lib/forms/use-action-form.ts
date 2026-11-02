"use client";

import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState, useTransition } from "react";
import type { DefaultValues, FieldValues, Resolver, UseFormProps } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { ZodErrorMap, ZodType } from "zod";

type ActionFormOptions<TFieldValues extends FieldValues, TData> = {
  schema: ZodType<TFieldValues>;
  defaultValues: DefaultValues<TFieldValues>;
  action: (values: TFieldValues) => Promise<ActionResult<TData>>;
  onSuccess?: (data: TData | undefined) => void;
  successToast?: { title: string; description?: string };
  formOptions?: Omit<UseFormProps<TFieldValues>, "defaultValues" | "resolver">;
  /** Wording for checks the schema does not phrase itself (see `publicFormErrorMap`). */
  errorMap?: ZodErrorMap;
  /**
   * Whether a failed action also raises a toast (default). A form that shows the failure in its
   * own notice sets this to false so the message is not said twice.
   */
  toastFailure?: boolean;
  /** Whether a server field error moves focus to its field (default). False with an error summary. */
  focusInvalidField?: boolean;
};

function actionFormResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
  errorMap?: ZodErrorMap,
): Resolver<TFieldValues> {
  // @hookform/resolvers v5 expects Zod 4 `$ZodType`; we use Zod 3 schemas at call sites.
  return zodResolver(schema as never, errorMap ? ({ errorMap } as never) : undefined);
}

/** RHF + server action: runs the action in a transition, maps `ActionResult` field errors to the form.
 */
export function useActionForm<TFieldValues extends FieldValues, TData = void>({
  schema,
  defaultValues,
  action,
  onSuccess,
  successToast,
  formOptions,
  errorMap,
  toastFailure = true,
  focusInvalidField = true,
}: ActionFormOptions<TFieldValues, TData>) {
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);
  const form = useForm<TFieldValues>({
    ...formOptions,
    resolver: actionFormResolver(schema, errorMap),
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
