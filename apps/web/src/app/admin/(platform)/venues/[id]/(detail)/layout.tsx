import { VenueDetailShell } from "@/components/admin/venue-detail/venue-detail-shell";
import { loadVenuesListIds } from "@/lib/admin/catalog/load-venues-list-page";
import { loadListRecordPager, requestListQuery } from "@/lib/admin/list-record-pager.server";
import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";
import { venueHref } from "@/lib/admin/venues/venues-staff-list.vm";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminVenueDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const [detail, pager] = await Promise.all([
    loadAdminVenueDetail(id),
    // Opened from the venues list: Previous and Next through that list.
    requestListQuery().then((listQuery) =>
      loadListRecordPager({
        listQuery,
        currentId: id,
        recordHref: venueHref,
        loadIds: loadVenuesListIds,
      }),
    ),
  ]);

  return (
    <VenueDetailShell venueId={id} detail={detail} pager={pager}>
      {children}
    </VenueDetailShell>
  );
}
