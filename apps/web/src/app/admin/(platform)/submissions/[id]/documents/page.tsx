import { SubmissionDocumentsTab } from "@/components/admin/submission-detail/tabs/documents-tab";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";

export default async function AdminSubmissionDocumentsPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staffDocuments = await getServerSubmissionDocuments(id);

  return <SubmissionDocumentsTab submissionId={id} initialDocuments={staffDocuments} />;
}
