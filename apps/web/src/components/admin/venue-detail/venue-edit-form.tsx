import { AdminVenueForm } from "@/components/admin/venue-form";
import type { Venue } from "@auction/types";

type Props = {
  venue: Venue;
  legalEntityDisplayName: string | null;
  salesUsingCount: number;
  cancelHref: string;
};

export function VenueEditForm({
  venue,
  legalEntityDisplayName,
  salesUsingCount,
  cancelHref,
}: Props) {
  return (
    <AdminVenueForm
      mode="edit"
      venue={venue}
      legalEntityDisplayName={legalEntityDisplayName}
      salesUsingCount={salesUsingCount}
      cancelHref={cancelHref}
    />
  );
}
