import { ReviewStep } from "@/components/dashboard/submission-wizard/steps/review-step";
import { EMPTY_SUBMISSION_FORM_VALUES } from "@/lib/forms/submission/item-submission-form-defaults";
import {
  SPECIALIST_RESPONSE_PROMISE,
  SUBMISSION_FINISH_LATER_LABEL,
  SUBMISSION_SUBMIT_LABEL,
} from "@/lib/marketing/sell-flow-copy";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

function ReviewStepHarness({
  values,
  onSubmitForReview = vi.fn(),
  onFinishLater = vi.fn(),
}: {
  values: ItemSubmissionFormValues;
  onSubmitForReview?: () => void;
  onFinishLater?: () => void;
}) {
  const form = useForm<ItemSubmissionFormValues>({ defaultValues: values });
  return (
    <ReviewStep
      form={form}
      isSubmitting={false}
      onJumpTo={vi.fn()}
      canSubmitForReview
      onFinishLater={onFinishLater}
      onSubmitForReview={onSubmitForReview}
    />
  );
}

describe("ReviewStep", () => {
  it("shows a single primary submit button and save link when ready", () => {
    render(
      <ReviewStepHarness
        values={{
          ...EMPTY_SUBMISSION_FORM_VALUES,
          title: "Study in Blue",
          categoryIds: ["cat-1"],
          images: ["https://example.com/a.jpg"],
        }}
      />,
    );

    expect(screen.getByText(new RegExp(SPECIALIST_RESPONSE_PROMISE))).toBeInTheDocument();
    expect(screen.getByTestId("wizard-submit-for-review")).toHaveTextContent(
      SUBMISSION_SUBMIT_LABEL,
    );
    const finishLater = screen.getByTestId("wizard-finish-later-review");
    expect(finishLater).toHaveTextContent(SUBMISSION_FINISH_LATER_LABEL);
    expect(screen.getAllByRole("button", { name: SUBMISSION_SUBMIT_LABEL })).toHaveLength(1);
  });

  it("has no quality score and one Change per section", () => {
    render(
      <ReviewStepHarness
        values={{
          ...EMPTY_SUBMISSION_FORM_VALUES,
          title: "Study in Blue",
          categoryIds: ["cat-1"],
          images: ["https://example.com/a.jpg"],
        }}
      />,
    );
    expect(screen.queryByText(/quality/i)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Change / })).toHaveLength(5);
  });

  it("invokes submit handler from the primary button", () => {
    const onSubmitForReview = vi.fn();
    render(
      <ReviewStepHarness
        values={{
          ...EMPTY_SUBMISSION_FORM_VALUES,
          title: "Study in Blue",
          categoryIds: ["cat-1"],
          images: ["https://example.com/a.jpg"],
        }}
        onSubmitForReview={onSubmitForReview}
      />,
    );

    fireEvent.click(screen.getByTestId("wizard-submit-for-review"));
    expect(onSubmitForReview).toHaveBeenCalledTimes(1);
  });
});
