import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { VenueCreateForm } from "@/components/admin/venue-detail/venue-create-form";
import { loadAdminVenueCreatePage } from "@/lib/admin/venues/load-venue-create-page";
import { FormPage, Notice } from "@auction/staff-ui";

export default async function AdminVenueNewPage() {
  const page = await loadAdminVenueCreatePage();

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[{ label: "Venues", href: "/admin/venues" }, { label: "New venue" }]}
        />
      }
      title="New venue"
      description="Save an onsite gallery or branch once, then choose it whenever you set up a sale there."
    >
      {page.setupError ? (
        <Notice tone="danger" alert title="The venue cannot be created yet">
          {page.setupError}
        </Notice>
      ) : (
        <VenueCreateForm platformLegalEntityId={page.platformLegalEntityId} />
      )}
    </FormPage>
  );
}
