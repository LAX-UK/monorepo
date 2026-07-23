import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailStickyMiniBar,
  CatalogDetailTabNav,
  type CatalogMobileAction,
  CatalogPostCreateSessionRoot,
} from "@/components/admin/catalog";
import {
  venueDetailTabHref,
  venueEditHref,
} from "@/components/admin/venue-detail/venue-detail-types";
import type { VenueDetail } from "@/lib/services/interfaces/admin-venue-service";
import { Button } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  venueId: string;
  detail: VenueDetail;
  children: ReactNode;
};

export function VenueDetailShell({ venueId, detail, children }: Props) {
  const { venue, salesUsingCount, legalEntityDisplayName = null } = detail;

  const statusBadge = <AdminStatusBadge domain="venue" status={venue.status} />;

  const mobileActions: CatalogMobileAction[] = [
    {
      id: "edit-venue",
      label: "Edit",
      href: venueEditHref(venueId),
      variant: "primary",
    },
  ];

  const tabSpecs = [
    { id: "overview", label: "Overview", href: venueDetailTabHref(venueId, "overview") },
    {
      id: "sales",
      label: salesUsingCount > 0 ? `Sales (${salesUsingCount})` : "Sales",
      href: venueDetailTabHref(venueId, "sales"),
    },
    { id: "activity", label: "Activity", href: venueDetailTabHref(venueId, "activity") },
  ];

  return (
    <CatalogPostCreateSessionRoot>
      <CatalogDetailShell
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[{ label: "Venues", href: "/admin/venues" }, { label: venue.name }]}
          />
        }
        eyebrow="Venue"
        title={venue.name}
        description={[venue.addressLine1, venue.city, venue.postcode].filter(Boolean).join(", ")}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            {legalEntityDisplayName ? (
              <Link
                href={`/admin/legal-entities/${venue.legalEntityId}`}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary hover:underline"
              >
                {legalEntityDisplayName}
              </Link>
            ) : null}
            {venue.slug ? (
              <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                /{venue.slug}
              </span>
            ) : null}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminPinPageButton label={venue.name} />
            {venue.status !== "archived" ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={venueEditHref(venueId)}>Edit</Link>
              </Button>
            ) : null}
          </div>
        }
        mobileActions={mobileActions}
        mobileMeta={
          <CatalogDetailMobileMeta
            entityId={venueId}
            updatedAt={venue.updatedAt}
            status={statusBadge}
            quickLinks={[]}
            primaryAction={
              venue.status !== "archived" ? (
                <Link
                  href={venueEditHref(venueId)}
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
                >
                  Edit venue →
                </Link>
              ) : null
            }
          />
        }
        stickySubnav={
          <>
            <CatalogDetailTabNav tabs={tabSpecs} entityKind="venue" aria-label="Venue sections" />
            <CatalogDetailStickyMiniBar
              items={[{ id: "sales", label: "Sales using", value: String(salesUsingCount) }]}
            />
          </>
        }
      >
        {children}
      </CatalogDetailShell>
    </CatalogPostCreateSessionRoot>
  );
}
