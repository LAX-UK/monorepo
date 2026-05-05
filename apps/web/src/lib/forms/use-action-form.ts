"use client";

import type { ActionResult, FieldErrorMap } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState, useTransition } from "react";
import type { DefaultValues, FieldPath, FieldValues, UseFormProps } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { ZodType } from "zod";

type ActionFormOptions<TFieldValues extends FieldValues, TData> = {
  schema: ZodType<TFieldValues>;
  defaultValues: DefaultValues<TFieldValues>;
  action: (values: TFieldValues) => Promise<ActionResult<TData>>;
  onSuccess?: (data: TData | undefined) => void;
  successToast?: { title: string; description?: string };
  formOptions?: Omit<UseFormProps<TFieldValues>, "defaultValues" | "resolver">;
};

/**
 * RHF + server action: runs the action in a transition, maps `ActionResult` field errors to the form.
 */
export function useActionForm<TFieldValues extends FieldValues, TData = void>({
  schema,
  defaultValues,
  action,
  onSuccess,
  successToast,
  formOptions,
}: ActionFormOptions<TFieldValues, TData>) {
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState<string | null>(null);
  const form = useForm<TFieldValues>({
    ...formOptions,
    // biome-ignore lint/suspicious/noExplicitAny: RHF v7 + @hookform/resolvers + zod 3 generic variance
    resolver: zodResolver(schema as any),
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
            applyFieldErrorsToForm(form, r.fieldErrors);
          }
          setRootError(r.error);
          notify.error(r.error);
        })();
      });
    },
    [action, onSuccess, successToast, form],
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

function applyFieldErrorsToForm<TFieldValues extends FieldValues>(
  form: ReturnType<typeof useForm<TFieldValues>>,
  fieldErrors: FieldErrorMap,
): void {
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (!messages?.length) continue;
    const msg = messages[0];
    if (msg == null) continue;
    const name = (key === "root" ? "root" : key) as FieldPath<TFieldValues>;
    form.setError(name, { type: "server", message: msg });
  }
}
