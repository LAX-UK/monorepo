import { VenueActivityTab } from "@/components/admin/venue-detail/tabs/activity-tab";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminVenueActivityPage({ params }: Props) {
  const { id } = await params;
  return <VenueActivityTab venueId={id} />;
}
