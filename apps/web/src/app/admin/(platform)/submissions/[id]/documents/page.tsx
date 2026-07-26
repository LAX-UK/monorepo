import { SubmissionDocumentsTab } from "@/components/admin/submission-detail/tabs/documents-tab";
import { loadAdminSubmissionDocumentsPage } from "@/lib/admin/submissions/load-submission-documents-page";
import { notFound } from "next/navigation";

export default async function AdminSubmissionDocumentsPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadAdminSubmissionDocumentsPage(id);
  if (!model) notFound();

  return (
    <SubmissionDocumentsTab
      submissionId={model.submissionId}
      initialDocuments={model.staffDocuments}
    />
  );
}
