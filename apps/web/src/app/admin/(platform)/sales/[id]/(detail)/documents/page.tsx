import { SaleDocumentsTab } from "@/components/admin/sale-detail/tabs/documents-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleDocumentsPage({ params }: Props) {
  const { id } = await params;
  await loadAdminSaleDetail(id);
  const documents = await getServerSaleDocuments(id).catch(() => []);

  return <SaleDocumentsTab saleId={id} documents={documents} />;
}
