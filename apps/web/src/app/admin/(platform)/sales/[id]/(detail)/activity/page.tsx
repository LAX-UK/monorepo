import { SaleActivityTab } from "@/components/admin/sale-detail/tabs/activity-tab";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSaleActivityPage({ params }: Props) {
  const { id } = await params;
  return <SaleActivityTab saleId={id} />;
}
