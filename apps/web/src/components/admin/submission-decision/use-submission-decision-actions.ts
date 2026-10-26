"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
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
import type { FieldValues, UseFormReturn } from "react-hook-form";
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
  /** The submission's title, for the questions the page asks. */
  title: string;
};

/** Puts a refusal where the person is looking: on its field when it names one, else on the form. */
function showFailure<T extends FieldValues>(
  form: UseFormReturn<T>,
  failure: { error: string; fieldErrors?: Record<string, string[] | undefined> | undefined },
) {
  if (failure.fieldErrors && Object.keys(failure.fieldErrors).length > 0) {
    applyActionFieldErrors(form, failure.fieldErrors, { focusField: false });
    return;
  }
  form.setError("root.server", { type: "server", message: failure.error });
}

/**
 * The decision tab's actions: start the review, accept for cataloguing, reject (asked about
 * first, since the seller is told) and create the draft lot. A refusal stays on the form it came
 * from, with what was typed kept.
 */
export function useSubmissionDecisionActions({
  submissionId,
  title,
}: UseSubmissionDecisionActionsInput) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const confirm = useStaffConfirm();
  const { ask } = confirm;

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
      form.clearErrors("root.server");
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
          showFailure(form, r);
        })();
      });
    },
    [router, submissionId],
  );

  const reject = useCallback(
    (values: RejectFormValues) =>
      ask({
        title: `Reject ${title}?`,
        description:
          "The seller is emailed your reason as written. A rejected submission cannot be reopened.",
        confirmLabel: "Reject submission",
        cancelLabel: "Keep reviewing",
        tone: "danger",
        run: () => adminRejectSubmissionResultAction(submissionId, values),
        success: "Submission rejected. The seller has been told.",
      }),
    [ask, submissionId, title],
  );

  const convert = useCallback(
    (values: ApproveFormValues, form: UseFormReturn<ApproveFormValues>) => {
      form.clearErrors("root.server");
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
          showFailure(form, r);
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
    dialog: confirm.dialog,
  };
}
