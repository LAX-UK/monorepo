import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogBreadcrumbs, CatalogFormShell } from "@/components/admin/catalog";
import { VenueCreateForm } from "@/components/admin/venue-detail/venue-create-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminVenueCreatePage } from "@/lib/admin/venues/load-venue-create-page";

export default async function AdminVenueNewPage() {
  const page = await loadAdminVenueCreatePage();

  return (
    <CatalogFormShell
      layout="wizard"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Venues", href: "/admin/venues" }, { label: "New" }]}
        />
      }
      title="New venue"
      description="Store reusable onsite gallery or branch information once, then select it during sale setup."
      {...(page.setupError
        ? {
            mobileActions: [
              {
                id: "back" as const,
                label: "Back to venues",
                variant: "secondary" as const,
                href: "/admin/venues",
              },
            ],
          }
        : {
            wizardMobile: {
              formId: CATALOG_FORM_IDS.venue,
              submitLabel: "Create venue",
              cancelHref: "/admin/venues",
            },
          })}
    >
      {page.setupError ? (
        <AdminListAlert title="Cannot create venue">{page.setupError}</AdminListAlert>
      ) : (
        <VenueCreateForm platformLegalEntityId={page.platformLegalEntityId} />
      )}
    </CatalogFormShell>
  );
}
