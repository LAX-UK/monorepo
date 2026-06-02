import { VenueDetailShell } from "@/components/admin/venue-detail/venue-detail-shell";
import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminVenueDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const detail = await loadAdminVenueDetail(id);

  return (
    <VenueDetailShell venueId={id} detail={detail}>
      {children}
    </VenueDetailShell>
  );
}
