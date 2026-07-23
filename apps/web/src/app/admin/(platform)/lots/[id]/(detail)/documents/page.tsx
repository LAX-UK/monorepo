import { LotDocumentsTabBoard } from "@/components/admin/lot-detail/lot-documents-tab-board";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotDocumentsPage({ params }: Props) {
  const { id } = await params;
  await loadAdminLotDetail(id);
  const documents = await getServerLotDocuments(id).catch(() => []);

  return <LotDocumentsTabBoard lotId={id} initialDocuments={documents} />;
}
