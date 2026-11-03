import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { VenueEditForm } from "@/components/admin/venue-detail/venue-edit-form";
import { loadAdminVenueEditPage } from "@/lib/admin/venues/load-venue-edit-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { FormPage, Notice, StaffButtonLink } from "@auction/staff-ui";
import type { Metadata } from "next";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const page = await loadAdminVenueEditPage(id);
  return metadataForPrivate(`Edit ${page.venue.name}`, "Update venue details.");
}

export default async function AdminVenueEditPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminVenueEditPage(id);
  const { venue, salesUsingCount, legalEntityDisplayName } = page;
  const isArchived = venue.status === "archived";

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[
            { label: "Venues", href: "/admin/venues" },
            { label: venue.name, href: page.detailHref },
            { label: "Edit" },
          ]}
        />
      }
      title={`Edit ${venue.name}`}
      description="Update the reusable gallery or branch details that onsite sales draw on."
      notice={
        isArchived ? (
          <Notice
            tone="info"
            title="This venue is archived and cannot be edited"
            actions={
              <StaffButtonLink size="sm" variant="secondary" href={page.detailHref} Link={Link}>
                Back to venue
              </StaffButtonLink>
            }
          >
            Sales already held there keep it, but it cannot be chosen for new sales.
          </Notice>
        ) : null
      }
    >
      {isArchived ? null : (
        <VenueEditForm
          venue={venue}
          legalEntityDisplayName={legalEntityDisplayName ?? null}
          salesUsingCount={salesUsingCount}
          cancelHref={page.detailHref}
        />
      )}
    </FormPage>
  );
}
