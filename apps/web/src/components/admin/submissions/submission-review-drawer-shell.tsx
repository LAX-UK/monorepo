"use client";

import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { SubmissionReviewWorkspace } from "@/components/admin/submissions/submission-review-workspace";
import type { SubmissionReviewViewModel } from "@/lib/data/view-models/submission-review.vm";
import type { ItemSubmission } from "@auction/types";
import { Sheet, SheetContent } from "@auction/ui";
import { useRouter } from "next/navigation";

type Props = {
  submissionId: string;
  vm: SubmissionReviewViewModel;
  submission: Pick<
    ItemSubmission,
    | "title"
    | "images"
    | "description"
    | "provenance"
    | "categoryId"
    | "categoryIds"
    | "convertedLotId"
    | "assignedToUserId"
  >;
  submitterDisplayName?: string | null;
  submitterUserId?: string | null;
  assigneeImage?: string | null;
  onClose?: () => void;
};

export function SubmissionReviewDrawerShell({
  submissionId,
  vm,
  submission,
  submitterDisplayName,
  submitterUserId,
  assigneeImage,
  onClose,
}: Props) {
  const router = useRouter();

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) {
          if (onClose) onClose();
          else router.back();
        }
      }}
    >
      <SheetContent side="right" className="w-full max-w-[700px] overflow-y-auto sm:max-w-[700px]">
        <div className="space-y-4 pt-2">
          <AdminPreviewSheetHeader
            title={vm.title}
            fullPageHref={`/admin/submissions/${submissionId}`}
            subtitle={
              <p className="truncate font-body text-sm text-on-surface-variant">
                {vm.sellerPreview}
              </p>
            }
          />
          <SubmissionReviewWorkspace
            vm={vm}
            submission={{
              title: submission.title,
              images: submission.images,
              description: submission.description,
              provenance: submission.provenance ?? [],
              categoryId: submission.categoryId,
              ...(submission.categoryIds ? { categoryIds: submission.categoryIds } : {}),
              convertedLotId: submission.convertedLotId,
              assignedToUserId: submission.assignedToUserId ?? null,
            }}
            layout="drawer"
            {...(submitterDisplayName ? { submitterDisplayName } : {})}
            {...(submitterUserId ? { submitterUserId } : {})}
            {...(assigneeImage ? { assigneeImage } : {})}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
