import { AdminVenueForm } from "@/components/admin/venue-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  platformLegalEntityId: string | null;
};

export function VenueCreateForm({ platformLegalEntityId }: Props) {
  return (
    <Surface variant="card" padding="md">
      <AdminVenueForm
        mode="create"
        platformLegalEntityId={platformLegalEntityId}
        cancelHref="/admin/venues"
        htmlFormId={CATALOG_FORM_IDS.venue}
        wizardLayout="sidebar"
      />
    </Surface>
  );
}
