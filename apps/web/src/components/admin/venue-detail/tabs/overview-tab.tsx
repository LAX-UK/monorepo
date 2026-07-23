import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { CatalogDetailSection } from "@/components/admin/catalog/catalog-detail-section";
import type { VenueDetail } from "@/lib/services/interfaces/admin-venue-service";
import Link from "next/link";

type Props = {
  venueId: string;
  detail: VenueDetail;
};

export function VenueOverviewTab({ venueId: _venueId, detail }: Props) {
  const { venue, salesUsingCount, legalEntityDisplayName = null } = detail;

  return (
    <CatalogDetailTabPanel title="Overview" framed={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <CatalogDetailSection title="Address">
          <div className="space-y-0.5 font-body text-sm text-on-surface">
            <p>{venue.addressLine1}</p>
            {venue.addressLine2 ? <p>{venue.addressLine2}</p> : null}
            <p>
              {venue.city}
              {venue.county ? `, ${venue.county}` : ""}
            </p>
            <p>{venue.postcode}</p>
            <p>{venue.country}</p>
          </div>
        </CatalogDetailSection>

        <CatalogDetailSection title="Status">
          <div className="space-y-2">
            <AdminStatusBadge domain="venue" status={venue.status} />
            {salesUsingCount > 0 ? (
              <p className="font-body text-sm text-on-surface-variant">
                Used by {salesUsingCount} sale{salesUsingCount !== 1 ? "s" : ""}.{" "}
                <Link href="/admin/sales" className="text-link underline-offset-2 hover:underline">
                  View sales
                </Link>
              </p>
            ) : (
              <p className="font-body text-sm text-on-surface-variant">
                No sales reference this venue.
              </p>
            )}
          </div>
        </CatalogDetailSection>

        <CatalogDetailSection title="Organisation">
          <div className="space-y-1 font-body text-sm">
            {legalEntityDisplayName ? (
              <Link
                href={`/admin/legal-entities/${venue.legalEntityId}`}
                className="font-medium text-link hover:underline"
              >
                {legalEntityDisplayName}
              </Link>
            ) : (
              <span className="font-mono text-xs text-on-surface-variant">
                {venue.legalEntityId}
              </span>
            )}
            <p className="font-body text-xs text-on-surface-variant">
              Venues can only be used by sales operated by the same legal entity.
            </p>
          </div>
        </CatalogDetailSection>

        {venue.contactPhone || venue.contactEmail || venue.website ? (
          <CatalogDetailSection title="Contact">
            <div className="space-y-1 font-body text-sm text-on-surface">
              {venue.contactPhone ? <p>{venue.contactPhone}</p> : null}
              {venue.contactEmail ? (
                <p>
                  <a href={`mailto:${venue.contactEmail}`} className="text-link hover:underline">
                    {venue.contactEmail}
                  </a>
                </p>
              ) : null}
              {venue.website ? (
                <p>
                  <a
                    href={venue.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link hover:underline"
                  >
                    {venue.website}
                  </a>
                </p>
              ) : null}
            </div>
          </CatalogDetailSection>
        ) : null}

        {venue.mapUrl || venue.latitude != null || venue.capacity != null ? (
          <CatalogDetailSection title="Details">
            <div className="space-y-1 font-body text-sm text-on-surface">
              {venue.capacity != null ? <p>Capacity: {venue.capacity}</p> : null}
              {venue.latitude != null && venue.longitude != null ? (
                <p className="font-mono text-xs text-on-surface-variant">
                  {venue.latitude}, {venue.longitude}
                </p>
              ) : null}
              {venue.mapUrl ? (
                <p>
                  <a
                    href={venue.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link hover:underline"
                  >
                    View on map
                  </a>
                </p>
              ) : null}
            </div>
          </CatalogDetailSection>
        ) : null}

        {venue.accessNotes || venue.parkingNotes || venue.directionsNotes ? (
          <CatalogDetailSection title="Visitor notes" className="sm:col-span-2">
            <div className="space-y-3 font-body text-sm text-on-surface">
              {venue.accessNotes ? (
                <div>
                  <p className="font-medium text-on-surface">Access</p>
                  <p className="text-on-surface-variant">{venue.accessNotes}</p>
                </div>
              ) : null}
              {venue.parkingNotes ? (
                <div>
                  <p className="font-medium text-on-surface">Parking</p>
                  <p className="text-on-surface-variant">{venue.parkingNotes}</p>
                </div>
              ) : null}
              {venue.directionsNotes ? (
                <div>
                  <p className="font-medium text-on-surface">Directions</p>
                  <p className="text-on-surface-variant">{venue.directionsNotes}</p>
                </div>
              ) : null}
            </div>
          </CatalogDetailSection>
        ) : null}
      </div>
    </CatalogDetailTabPanel>
  );
}
