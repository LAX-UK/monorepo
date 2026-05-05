"use client";

import { Button } from "@/components/ui/button";
import {
  submitForReviewFromValuesAction,
  withdrawSubmissionFromValuesAction,
} from "@/lib/actions/submissions";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
                  notify.success("Submitted for review");
                  router.refresh();
                  return;
                }
                notify.error(r.error);
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
                  notify.success("Withdrawn");
                  router.refresh();
                  return;
                }
                notify.error(r.error);
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
