import { DetailBoardShell } from "@/components/admin/catalog/detail-board";
import { SubmissionDocumentsSection } from "@/components/admin/submission-review/submission-staff-sections";
import type { EntityDocument } from "@auction/types";

type Props = {
  submissionId: string;
  initialDocuments: EntityDocument[];
};

export function SubmissionDocumentsTab({ submissionId, initialDocuments }: Props) {
  return (
    <DetailBoardShell
      title="Documents"
      description="Seller uploads and staff attachments."
      count={initialDocuments.length}
    >
      <SubmissionDocumentsSection submissionId={submissionId} initialDocuments={initialDocuments} />
    </DetailBoardShell>
  );
}
