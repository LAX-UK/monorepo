import type { ItemSubmissionFormValues } from "@auction/validators";
import type { UseFormReturn } from "react-hook-form";
import { REQUIRED_ERROR_TYPE, collectStepErrors } from "./step-errors";
import type { WizardStepDefinition } from "./step-validation";

/**
 * Checks one step's fields: the form's own schema first, then what the step needs before the
 * person can go on, whose words replace the schema's so each problem reads one way. Marks every
 * problem on its field and says whether the step is clear.
 */
export async function validateStep(
  form: UseFormReturn<ItemSubmissionFormValues>,
  step: Pick<WizardStepDefinition, "fields">,
): Promise<boolean> {
  const schemaOk = await form.trigger([...step.fields], { shouldFocus: false });
  const needed = collectStepErrors(step, form.getValues());
  for (const { field, message } of needed) {
    form.setError(field, { type: REQUIRED_ERROR_TYPE, message });
  }
  return schemaOk && needed.length === 0;
}
