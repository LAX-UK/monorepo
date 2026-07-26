import { LotDocumentsTabBoard } from "@/components/admin/lot-detail/lot-documents-tab-board";
import { loadAdminLotDocumentsPage } from "@/lib/admin/lots/load-lot-documents-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotDocumentsPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLotDocumentsPage(id);

  return <LotDocumentsTabBoard lotId={page.lotId} initialDocuments={page.documents} />;
}
