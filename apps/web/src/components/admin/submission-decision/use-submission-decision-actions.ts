"use client";

import {
  adminAcceptSubmissionResultAction,
  adminConvertSubmissionResultAction,
  adminRejectSubmissionResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import { trackStaffAccept, trackStaffConvert } from "@/lib/analytics/sell-funnel";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { notify } from "@/lib/ui/notify";
import { type ApproveSubmissionBody, rejectSubmissionBodySchema } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

export const approveFormSchema = z.object({
  reviewNotes: z.string().max(5000),
  artistId: z.string().uuid().nullable().optional(),
});

export type ApproveFormValues = z.infer<typeof approveFormSchema>;

export const rejectFormSchema = rejectSubmissionBodySchema;
export type RejectFormValues = z.infer<typeof rejectFormSchema>;

type UseSubmissionDecisionActionsInput = {
  submissionId: string;
};

export function useSubmissionDecisionActions({ submissionId }: UseSubmissionDecisionActionsInput) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const startReview = useCallback(() => {
    startTransition(() => {
      void (async () => {
        const r = await adminStartSubmissionReviewResultAction(submissionId);
        if (r.ok) {
          notify.success("Review started");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  }, [router, submissionId]);

  const accept = useCallback(
    (values: ApproveFormValues, form: UseFormReturn<ApproveFormValues>) => {
      startTransition(() => {
        void (async () => {
          const body: ApproveSubmissionBody = {};
          const trimmed = values.reviewNotes.trim();
          if (trimmed) body.reviewNotes = trimmed;
          const r = await adminAcceptSubmissionResultAction(submissionId, body);
          if (r.ok) {
            trackStaffAccept(submissionId);
            notify.success("Accepted for cataloguing");
            router.refresh();
            return;
          }
          if (r.fieldErrors) {
            applyActionFieldErrors(form, r.fieldErrors);
          }
          notify.error(r.error);
        })();
      });
    },
    [router, submissionId],
  );

  const reject = useCallback(
    (values: RejectFormValues, form: UseFormReturn<RejectFormValues>) => {
      startTransition(() => {
        void (async () => {
          const r = await adminRejectSubmissionResultAction(submissionId, values);
          if (r.ok) {
            notify.success("Submission rejected");
            router.refresh();
            return;
          }
          if (r.fieldErrors) {
            applyActionFieldErrors(form, r.fieldErrors);
          }
          notify.error(r.error);
        })();
      });
    },
    [router, submissionId],
  );

  const convert = useCallback(
    (values: ApproveFormValues, form: UseFormReturn<ApproveFormValues>) => {
      startTransition(() => {
        void (async () => {
          const body: ApproveSubmissionBody = {};
          const trimmed = values.reviewNotes.trim();
          if (trimmed) body.reviewNotes = trimmed;
          if (values.artistId) body.artistId = values.artistId;
          const r = await adminConvertSubmissionResultAction(submissionId, body);
          if (r.ok) {
            trackStaffConvert(submissionId);
            const pct = r.data?.readinessPercent;
            notify.success(
              pct != null ? `Draft lot created — ${pct}% catalogue ready` : "Draft lot created",
            );
            if (r.data?.lotId) {
              router.push(`/admin/lots/${r.data.lotId}`);
              return;
            }
            router.refresh();
            return;
          }
          if (r.fieldErrors) {
            applyActionFieldErrors(form, r.fieldErrors);
          }
          notify.error(r.error);
        })();
      });
    },
    [router, submissionId],
  );

  return {
    pending,
    startReview,
    accept,
    reject,
    convert,
  };
}
