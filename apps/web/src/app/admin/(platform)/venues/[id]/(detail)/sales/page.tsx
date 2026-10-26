import { VenueSalesTab } from "@/components/admin/venue-detail/tabs/sales-tab";
import { loadAdminVenueSalesPage } from "@/lib/admin/venues/load-venue-sales-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminVenueSalesPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminVenueSalesPage(id);

  return <VenueSalesTab salesUsingCount={page.salesUsingCount} />;
}
