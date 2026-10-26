import { AdminVenueForm } from "@/components/admin/venue-form";

type Props = {
  platformLegalEntityId: string | null;
};

export function VenueCreateForm({ platformLegalEntityId }: Props) {
  return (
    <AdminVenueForm
      mode="create"
      platformLegalEntityId={platformLegalEntityId}
      cancelHref="/admin/venues"
    />
  );
}
