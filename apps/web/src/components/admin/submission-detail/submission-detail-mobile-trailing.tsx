"use client";

import { adminStartSubmissionReviewResultAction } from "@/lib/actions/admin-submissions";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { useViewerCapabilities } from "@/lib/auth/capabilities/viewer-capabilities-context";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import type { ItemSubmissionStatus } from "@auction/types";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
    return <SubmissionDecisionMobileActions />;
  }

  return null;
}

function SubmissionDecisionMobileActions() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="submit"
        size="sm"
        className="min-h-11"
        form={CATALOG_FORM_IDS.submissionApprove}
      >
        Approve
      </Button>
      <div className="lg:hidden">
        <BottomSheet open={moreOpen} onOpenChange={setMoreOpen}>
          <BottomSheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1">
              <MoreHorizontal className="size-4" aria-hidden />
              More
            </Button>
          </BottomSheetTrigger>
          <BottomSheetContent>
            <BottomSheetHeader>
              <BottomSheetTitle>More actions</BottomSheetTitle>
            </BottomSheetHeader>
            <div className="flex flex-col gap-2 p-4">
              <Button
                type="submit"
                variant="destructive"
                className="min-h-11 w-full"
                form={CATALOG_FORM_IDS.submissionReject}
                onClick={() => setMoreOpen(false)}
              >
                Reject
              </Button>
            </div>
          </BottomSheetContent>
        </BottomSheet>
      </div>
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        className="hidden min-h-11 lg:inline-flex"
        form={CATALOG_FORM_IDS.submissionReject}
      >
        Reject
      </Button>
    </div>
  );
}
