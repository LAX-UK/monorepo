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
  onSaveDraft: () => void;
  onSubmitForReview: () => void;
};
