import { VenueActivityTab } from "@/components/admin/venue-detail/tabs/activity-tab";
import { loadAdminVenueActivityPage } from "@/lib/admin/venues/load-venue-activity-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminVenueActivityPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminVenueActivityPage(id);

  return <VenueActivityTab venueId={page.venueId} events={page.events} />;
}
