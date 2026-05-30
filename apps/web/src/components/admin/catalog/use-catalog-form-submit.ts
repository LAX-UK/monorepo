"use client";

import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import { type TransitionStartFunction, useCallback, useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { z as zod } from "zod";

export async function validateAllCatalogWizardSteps<T extends FieldValues>(
  form: UseFormReturn<T>,
  formSchema: zod.ZodType<T>,
  stepFields: readonly (readonly Path<T>[])[],
  wizardGoTo: (index: number) => void,
): Promise<boolean> {
  for (let i = 0; i < stepFields.length; i++) {
    const fields = stepFields[i];
    if (fields?.length && !(await validateWizardStep(form, formSchema, [...fields]))) {
      wizardGoTo(i);
      return false;
    }
  }
  return true;
}

type ActionFailureOpts = {
  status?: number;
  errorCode?: string;
  meta?: Record<string, unknown>;
};

/** Shared toast for catalog form server action failures. */
export function notifyCatalogActionFailure(
  error: string,
  opts?: ActionFailureOpts,
  humanize?: (input: { message: string; errorCode?: string }) => string,
): void {
  const message = actionFailureNotifyMessage(error, opts ?? {});
  notify.error(
    humanize
      ? humanize({
          message,
          ...(opts?.errorCode !== undefined ? { errorCode: opts.errorCode } : {}),
        })
      : message,
  );
}

/** Wrap async submit work in a React transition. */
export function runCatalogFormTransition(
  startTransition: TransitionStartFunction,
  task: () => void | Promise<void>,
): void {
  startTransition(() => {
    void task();
  });
}

export function useCatalogValidationBanner() {
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
  const [validationStepIndex, setValidationStepIndex] = useState<number | null>(null);

  const clearValidationBanner = useCallback(() => {
    setValidationBanner(null);
    setValidationStepIndex(null);
  }, []);

  const setValidationFailure = useCallback((message: string | null, stepIndex?: number) => {
    setValidationBanner(message);
    setValidationStepIndex(stepIndex ?? null);
  }, []);

  return {
    validationBanner,
    validationStepIndex,
    clearValidationBanner,
    setValidationFailure,
    notifyValidationFailure: notifyAdminFormValidationFailure,
  };
}
