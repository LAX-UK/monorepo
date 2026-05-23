import { SaleScheduleTab } from "@/components/admin/sale-detail/tabs/schedule-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleSchedulePage({ params }: Props) {
  const { id } = await params;
  const { sale, lots } = await loadAdminSaleDetail(id);
  return <SaleScheduleTab saleId={id} sale={sale} lots={lots} />;
}
