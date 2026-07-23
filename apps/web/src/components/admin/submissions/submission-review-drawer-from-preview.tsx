"use client";

import { SubmissionReviewDrawerShell } from "@/components/admin/submissions/submission-review-drawer-shell";
import type { LoadedSubmissionReview } from "@/lib/admin/submissions/load-submission-review";
import { useRouter } from "next/navigation";

type Props = {
  loaded: LoadedSubmissionReview;
};

export function SubmissionReviewDrawerFromPreview({ loaded }: Props) {
  const router = useRouter();

  return (
    <SubmissionReviewDrawerShell
      submissionId={loaded.vm.submissionId}
      vm={loaded.vm}
      submission={loaded.submission}
      onClose={() => router.push("/admin/submissions")}
      {...(loaded.submitterDisplayName
        ? { submitterDisplayName: loaded.submitterDisplayName }
        : {})}
      {...(loaded.submitterUserId ? { submitterUserId: loaded.submitterUserId } : {})}
      {...(loaded.assigneeImage ? { assigneeImage: loaded.assigneeImage } : {})}
    />
  );
}
