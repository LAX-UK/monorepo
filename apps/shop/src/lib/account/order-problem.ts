import {
  ORDER_PROBLEM_DETAILS_MAX_LENGTH,
  ORDER_PROBLEM_REASONS,
  type OrderProblemReason,
} from "@auction/shop-contracts";

export { ORDER_PROBLEM_DETAILS_MAX_LENGTH };

/** The reasons a shopper can pick, in the order shown, with what each one means. */
export const ORDER_PROBLEM_REASON_OPTIONS: ReadonlyArray<{
  value: OrderProblemReason;
  label: string;
  description: string;
}> = [
  {
    value: "changed_mind",
    label: "I want to cancel",
    description: "You can cancel within 14 days of delivery without giving a reason.",
  },
  {
    value: "damaged",
    label: "It arrived damaged",
    description: "Keep the packaging. We may ask you for photos.",
  },
  { value: "wrong_item", label: "I received the wrong item", description: "" },
  { value: "not_arrived", label: "It has not arrived", description: "" },
  { value: "other", label: "Something else", description: "" },
];

export const ORDER_PROBLEM_FIELD_IDS = {
  reason: "problem-reason",
  details: "problem-details",
} as const;

export type OrderProblemField = keyof typeof ORDER_PROBLEM_FIELD_IDS;
export type OrderProblemDetails = { reason: OrderProblemReason | ""; details: string };
export type OrderProblemErrors = Partial<Record<OrderProblemField, string>>;

export function isOrderProblemReason(value: string): value is OrderProblemReason {
  return (ORDER_PROBLEM_REASONS as readonly string[]).includes(value);
}

/** What is missing or too long, in the words shown at each field and in the summary. */
export function validateOrderProblem(input: OrderProblemDetails): OrderProblemErrors {
  const errors: OrderProblemErrors = {};
  if (!input.reason) errors.reason = "Choose what went wrong";
  const details = input.details.trim();
  if (!details) {
    errors.details = "Tell us what happened";
  } else if (details.length > ORDER_PROBLEM_DETAILS_MAX_LENGTH) {
    errors.details = `Keep it to ${ORDER_PROBLEM_DETAILS_MAX_LENGTH.toLocaleString("en-GB")} characters or fewer`;
  }
  return errors;
}

export function orderedOrderProblemErrors(
  errors: OrderProblemErrors,
): Array<{ fieldId: string; message: string }> {
  return (["reason", "details"] as const).flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: ORDER_PROBLEM_FIELD_IDS[field], message }] : [];
  });
}
