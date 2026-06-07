"use client";

import { submitForReviewFromValuesAction } from "@/lib/actions/submissions";
import {
  SUBMISSION_READY_TO_SUBMIT_BANNER,
  SUBMISSION_SUBMIT_LABEL,
} from "@/lib/marketing/sell-flow-copy";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  submissionId: string;
};

/** Prominent submit CTA when a saved submission has all required fields. */
export function SubmissionReadyToSubmitBanner({ submissionId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

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
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (pending) return;
          setPending(true);
          void (async () => {
            try {
              const r = await submitForReviewFromValuesAction(submissionId);
              if (r.ok) {
                notify.success("Submitted for review");
                router.refresh();
                return;
              }
              notify.error(r.error);
            } finally {
              setPending(false);
            }
          })();
        }}
        data-testid="submission-detail-submit-for-review"
      >
        {pending ? "Submitting…" : SUBMISSION_SUBMIT_LABEL}
      </Button>
    </Surface>
  );
}
