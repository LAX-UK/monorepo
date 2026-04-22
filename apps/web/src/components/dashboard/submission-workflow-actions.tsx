"use client";

import { Button } from "@/components/ui/button";
import {
  submitForReviewFromValuesAction,
  withdrawSubmissionFromValuesAction,
} from "@/lib/actions/submissions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

type Props = {
  submissionId: string;
  canSubmit: boolean;
  canWithdraw: boolean;
};

export function SubmissionWorkflowActions({ submissionId, canSubmit, canWithdraw }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-3">
      {canSubmit ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              void (async () => {
                const r = await submitForReviewFromValuesAction(submissionId);
                if (r.ok) {
                  toast.success("Submitted for review");
                  router.refresh();
                  return;
                }
                toast.error(r.error);
              })();
            });
          }}
        >
          Submit for review
        </Button>
      ) : null}
      {canWithdraw ? (
        <Button
          type="button"
          disabled={pending}
          variant="secondary"
          onClick={() => {
            startTransition(() => {
              void (async () => {
                const r = await withdrawSubmissionFromValuesAction(submissionId);
                if (r.ok) {
                  toast.success("Withdrawn");
                  router.refresh();
                  return;
                }
                toast.error(r.error);
              })();
            });
          }}
        >
          Withdraw
        </Button>
      ) : null}
    </div>
  );
}
