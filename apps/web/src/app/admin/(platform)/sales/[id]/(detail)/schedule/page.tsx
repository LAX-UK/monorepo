import { SaleScheduleTab } from "@/components/admin/sale-detail/tabs/schedule-tab";
import { loadAdminSaleSchedulePage } from "@/lib/admin/sales/load-sale-schedule-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleSchedulePage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminSaleSchedulePage(id);
  return <SaleScheduleTab saleId={page.saleId} sale={page.sale} lots={page.lots} />;
}
