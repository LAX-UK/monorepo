import { AdminVenueForm } from "@/components/admin/venue-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { Venue } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  venue: Venue;
  legalEntityDisplayName: string | null;
  salesUsingCount: number;
  cancelHref: string;
  isArchived?: boolean;
};

export function VenueEditForm({
  venue,
  legalEntityDisplayName,
  salesUsingCount,
  cancelHref,
  isArchived = false,
}: Props) {
  return (
    <Surface variant="card" padding="md">
      <AdminVenueForm
        mode="edit"
        venue={venue}
        legalEntityDisplayName={legalEntityDisplayName}
        salesUsingCount={salesUsingCount}
        cancelHref={cancelHref}
        htmlFormId={CATALOG_FORM_IDS.venue}
        wizardLayout="sidebar"
        isArchived={isArchived}
      />
    </Surface>
  );
}
