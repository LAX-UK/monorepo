"use client";

import type { ErrorSummaryItem } from "@auction/ui/lax/error-summary";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { useCallback, useEffect, useState } from "react";
import { type UseFormReturn, get, useFormState } from "react-hook-form";
import {
  REQUIRED_ERROR_TYPE,
  collectStepErrors,
  sellFieldControlId,
  stepUsesSummary,
} from "./step-errors";
import type { WizardStepDefinition } from "./step-validation";

/**
 * The list of problems at the top of a step with more than one field. It stays empty until the
 * person has tried to continue, then follows the fields: a line goes as its field is put right,
 * and `focusKey` changes on each failed try, so focus moves to the list only then.
 */
export function useStepErrorSummary(
  form: UseFormReturn<ItemSubmissionFormValues>,
  step: Pick<WizardStepDefinition, "id" | "fields"> | undefined,
) {
  const fields = step?.fields ?? [];
  const { errors } = useFormState({ control: form.control, name: [...fields] });
  const [failedTries, setFailedTries] = useState(0);
  const stepId = step?.id;

  // Each step starts with a clean list: the problems of another step are not this one's.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the step changes
  useEffect(() => {
    setFailedTries(0);
  }, [stepId]);

  // A problem goes as soon as its field is put right, without waiting for the person to leave it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `fields` follows `stepId`
  useEffect(() => {
    const subscription = form.watch(() => {
      const stillNeeded = new Set(
        collectStepErrors({ fields }, form.getValues()).map((e) => e.field),
      );
      for (const field of fields) {
        const current = form.getFieldState(field).error;
        if (current?.type === REQUIRED_ERROR_TYPE && !stillNeeded.has(field))
          form.clearErrors(field);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, stepId]);

  const items: ErrorSummaryItem[] =
    step && failedTries > 0 && stepUsesSummary(step)
      ? step.fields.flatMap((field) => {
          const message: unknown = get(errors, field)?.message;
          return typeof message === "string" && message
            ? [{ fieldId: sellFieldControlId(field), message }]
            : [];
        })
      : [];

  const markFailedTry = useCallback(() => setFailedTries((tries) => tries + 1), []);

  return { items, focusKey: failedTries, markFailedTry };
}
