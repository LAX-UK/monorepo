import {
  CatalogBreadcrumbs,
  CatalogDetailActionError,
  CatalogFormShell,
} from "@/components/admin/catalog";
import { AdminVenueForm } from "@/components/admin/venue-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await loadAdminVenueDetail(id);
  return metadataForPrivate(`Edit ${detail.venue.name}`, "Update venue details.");
}

export default async function AdminVenueEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const detail = await loadAdminVenueDetail(id);
  const { venue, salesUsingCount, legalEntityDisplayName } = detail;

  return (
    <CatalogFormShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Venues", href: "/admin/venues" },
            { label: venue.name, href: `/admin/venues/${id}` },
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
          href: `/admin/venues/${id}`,
        },
      ]}
    >
      <CatalogDetailActionError error={sp.error} title="Could not save venue" />
      <AdminVenueForm
        mode="edit"
        venue={venue}
        legalEntityDisplayName={legalEntityDisplayName ?? null}
        salesUsingCount={salesUsingCount}
        cancelHref={`/admin/venues/${id}`}
        isArchived={venue.status === "archived"}
      />
    </CatalogFormShell>
  );
}
