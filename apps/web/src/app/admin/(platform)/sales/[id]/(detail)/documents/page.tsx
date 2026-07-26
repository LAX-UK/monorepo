import { SaleDocumentsTab } from "@/components/admin/sale-detail/tabs/documents-tab";
import { loadAdminSaleDocumentsPage } from "@/lib/admin/sales/load-sale-documents-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleDocumentsPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminSaleDocumentsPage(id);

  return (
    <SaleDocumentsTab saleId={page.saleId} saleTitle={page.saleTitle} documents={page.documents} />
  );
}
