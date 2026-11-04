import { VenueOverviewTab } from "@/components/admin/venue-detail/tabs/overview-tab";
import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminVenueOverviewPage({ params }: Props) {
  const { id } = await params;
  const detail = await loadAdminVenueDetail(id);

  return <VenueOverviewTab venueId={id} detail={detail} />;
}
