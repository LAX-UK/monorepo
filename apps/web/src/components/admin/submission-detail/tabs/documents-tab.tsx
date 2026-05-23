import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { SubmissionDocumentsSection } from "@/components/admin/submission-review/submission-staff-sections";
import type { EntityDocument } from "@auction/types";

type Props = {
  submissionId: string;
  initialDocuments: EntityDocument[];
};

export function SubmissionDocumentsTab({ submissionId, initialDocuments }: Props) {
  return (
    <CatalogDetailTabPanel title="Documents" description="Seller uploads and staff attachments.">
      <SubmissionDocumentsSection submissionId={submissionId} initialDocuments={initialDocuments} />
    </CatalogDetailTabPanel>
  );
}
