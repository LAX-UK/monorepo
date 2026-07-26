import {
  CatalogBreadcrumbs,
  CatalogDetailActionError,
  CatalogFormShell,
} from "@/components/admin/catalog";
import { VenueEditForm } from "@/components/admin/venue-detail/venue-edit-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminVenueEditPage } from "@/lib/admin/venues/load-venue-edit-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const page = await loadAdminVenueEditPage(id);
  return metadataForPrivate(`Edit ${page.venue.name}`, "Update venue details.");
}

export default async function AdminVenueEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = await loadAdminVenueEditPage(id);
  const { venue, salesUsingCount, legalEntityDisplayName } = page;
  const isArchived = venue.status === "archived";

  return (
    <CatalogFormShell
      layout="wizard"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Venues", href: "/admin/venues" },
            { label: venue.name, href: page.detailHref },
            { label: "Edit" },
          ]}
        />
      }
      title="Edit venue"
      description="Update reusable gallery and branch details used by future onsite sales."
      {...(isArchived
        ? {
            mobileActions: [
              {
                id: "back" as const,
                label: "Back to venue",
                variant: "secondary" as const,
                href: page.detailHref,
              },
            ],
          }
        : {
            wizardMobile: {
              formId: CATALOG_FORM_IDS.venue,
              submitLabel: "Save changes",
              cancelHref: page.detailHref,
              alwaysShowSubmit: true,
            },
          })}
    >
      <CatalogDetailActionError error={sp.error} title="Could not save venue" />
      <VenueEditForm
        venue={venue}
        legalEntityDisplayName={legalEntityDisplayName ?? null}
        salesUsingCount={salesUsingCount}
        cancelHref={page.detailHref}
        isArchived={isArchived}
      />
    </CatalogFormShell>
  );
}
