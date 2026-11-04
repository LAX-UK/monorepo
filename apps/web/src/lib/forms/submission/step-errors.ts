import type { ItemSubmissionFormValues } from "@auction/validators";
import type { FieldPath } from "react-hook-form";
import { SELL_FORM_ERRORS } from "./sell-form-copy";
import type { WizardStepDefinition } from "./step-validation";

type FieldName = FieldPath<ItemSubmissionFormValues>;

export type StepError = { field: FieldName; message: string };

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

/** The `type` of a problem the step's own rules set, so it can be cleared when put right. */
export const REQUIRED_ERROR_TYPE = "required";

type Rule = (values: ItemSubmissionFormValues) => string | null;

/**
 * What a step needs before the person can go on, one rule per field. A step lists the fields it
 * owns; a field without a rule here is checked only by the form's own schema.
 */
const FIELD_RULES: Partial<Record<FieldName, Rule>> = {
  title: (v) => (v.title.trim() ? null : SELL_FORM_ERRORS.title),
  categoryIds: (v) => (v.categoryIds.length > 0 ? null : SELL_FORM_ERRORS.category),
  images: (v) => (v.images.length > 0 ? null : SELL_FORM_ERRORS.photo),
  askingPrice: (v) => priceProblem(v.askingPrice),
  reservePrice: (v) => priceProblem(v.reservePrice),
};

function priceProblem(raw: string): string | null {
  const value = raw.trim();
  return value === "" || PRICE_PATTERN.test(value) ? null : SELL_FORM_ERRORS.price;
}

/** The problems in a step's fields, in the order the fields appear. */
export function collectStepErrors(
  step: Pick<WizardStepDefinition, "fields">,
  values: ItemSubmissionFormValues,
): StepError[] {
  const errors: StepError[] = [];
  for (const field of step.fields) {
    const message = FIELD_RULES[field]?.(values) ?? null;
    if (message) errors.push({ field, message });
  }
  return errors;
}

/**
 * A step with more than one field lists its problems at the top as well as at each field. A step
 * that is one control (the photos) says it once, under the control.
 */
export function stepUsesSummary(step: Pick<WizardStepDefinition, "fields">): boolean {
  return step.fields.length > 1;
}

/** The stable name a field's form item takes, so the summary can reach its control. */
export function sellFieldItemId(field: FieldName): string {
  return `sell-field-${field}`;
}

/** The id of a field's control, as the form item derives it from the item's name. */
export function sellFieldControlId(field: FieldName): string {
  return `${sellFieldItemId(field)}-form-item`;
}
