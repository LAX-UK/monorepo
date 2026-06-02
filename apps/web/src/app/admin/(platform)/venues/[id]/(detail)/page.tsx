import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
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
      <CatalogDetailActionError error={sp.error} title="Could not save venue" />
      <VenueOverviewTab venueId={id} detail={detail} />
    </>
  );
}
