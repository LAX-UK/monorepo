"use client";

import { adminStartSubmissionReviewResultAction } from "@/lib/actions/admin-submissions";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { useViewerCapabilities } from "@/lib/auth/capabilities/viewer-capabilities-context";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import type { ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
};

/** Workflow actions for submission detail mobile bar trailing slot. */
export function SubmissionDetailMobileTrailing({ submissionId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { can } = useViewerCapabilities();
  const canReview = can(SUBMISSIONS_ACCESS);

  if (!canReview) return null;

  if (status === "submitted") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-11"
        disabled={pending}
        onClick={() => {
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
        }}
      >
        Start review
      </Button>
    );
  }

  if (status === "under_review") {
    return (
      <div className="flex flex-wrap justify-end gap-1">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="min-h-11"
          form={CATALOG_FORM_IDS.submissionApprove}
        >
          Approve
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="min-h-11"
          form={CATALOG_FORM_IDS.submissionReject}
        >
          Reject
        </Button>
      </div>
    );
  }

  return null;
}
