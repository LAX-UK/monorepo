import {
  CatalogBreadcrumbs,
  CatalogDetailActionError,
  CatalogFormShell,
} from "@/components/admin/catalog";
import { AdminVenueForm } from "@/components/admin/venue-form";
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

  return (
    <CatalogFormShell
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
      mobileActions={[
        {
          id: "save",
          label: "Save changes",
          variant: "primary",
          htmlForm: CATALOG_FORM_IDS.venue,
        },
        {
          id: "cancel",
          label: "Cancel",
          variant: "secondary",
          href: page.detailHref,
        },
      ]}
    >
      <CatalogDetailActionError error={sp.error} title="Could not save venue" />
      <AdminVenueForm
        mode="edit"
        venue={venue}
        legalEntityDisplayName={legalEntityDisplayName ?? null}
        salesUsingCount={salesUsingCount}
        cancelHref={page.detailHref}
        isArchived={venue.status === "archived"}
      />
    </CatalogFormShell>
  );
}
