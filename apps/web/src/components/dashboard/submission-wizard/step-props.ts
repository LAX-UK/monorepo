import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import type { ItemSubmissionFormValues } from "@auction/validators";
import type { UseFormReturn } from "react-hook-form";

export type StepProps = {
  form: UseFormReturn<ItemSubmissionFormValues>;
  isSubmitting: boolean;
};

export type BasicsStepProps = StepProps & {
  categories: SubmissionCategoryOption[];
};

export type ReviewStepProps = StepProps & {
  onJumpTo: (stepIndex: number) => void;
  canSubmitForReview: boolean;
  onFinishLater: () => void;
  onSubmitForReview: () => void;
  /** Label of the primary button; "Submit for review" unless the flow continues elsewhere. */
  submitLabel?: string;
  /** A section the surrounding flow puts first, such as "Selling as" with its own Change. */
  lead?: import("react").ReactNode;
};
