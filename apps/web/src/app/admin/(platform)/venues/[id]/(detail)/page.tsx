import { StaffActionError } from "@/components/admin/staff/staff-action-error";
import { VenueOverviewTab } from "@/components/admin/venue-detail/tabs/overview-tab";
import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminVenueOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const detail = await loadAdminVenueDetail(id);

  return (
    <>
      <StaffActionError error={sp.error} title="The venue was not saved" />
      <VenueOverviewTab venueId={id} detail={detail} />
    </>
  );
}
