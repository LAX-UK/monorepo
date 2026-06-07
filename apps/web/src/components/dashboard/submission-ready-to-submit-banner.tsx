"use client";

import {
  SUBMISSION_READY_TO_SUBMIT_BANNER,
  SUBMISSION_SUBMIT_LABEL,
} from "@/lib/marketing/sell-flow-copy";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  onSubmit: () => void;
  isSubmitting?: boolean;
};

/** Prominent submit CTA when a saved submission has all required fields. */
export function SubmissionReadyToSubmitBanner({ onSubmit, isSubmitting = false }: Props) {
  return (
    <Surface
      variant="quiet"
      padding="md"
      className="flex flex-col gap-4 border-primary/30 bg-primary/5 sm:flex-row sm:items-center sm:justify-between"
      data-testid="submission-ready-to-submit-banner"
    >
      <p className="font-body text-sm font-medium text-on-surface">
        {SUBMISSION_READY_TO_SUBMIT_BANNER}
      </p>
      <Button
        type="button"
        variant="cta"
        size="lg"
        className="w-full shrink-0 sm:w-auto"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        onClick={() => {
          if (isSubmitting) return;
          onSubmit();
        }}
        data-testid="submission-detail-submit-for-review"
      >
        {isSubmitting ? "Submitting…" : SUBMISSION_SUBMIT_LABEL}
      </Button>
    </Surface>
  );
}
