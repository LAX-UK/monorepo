import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import { venueDetailTabHref } from "@/components/admin/venue-detail/venue-detail-types";
import type { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

type Props = {
  venueId: string;
  events: Awaited<ReturnType<typeof getAdminDomainEventsForAggregate>>;
};

export function VenueActivityTab({ venueId, events }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Activity"
      description="Timeline of changes and key events for this venue."
    >
      <CatalogDomainEventsTimeline
        events={events}
        exportFilters={{ aggregateType: "venue", aggregateId: venueId }}
        showTechnicalDetails={false}
      />
    </CatalogDetailTabPanel>
  );
}

export function venueActivityTabHref(venueId: string): string {
  return venueDetailTabHref(venueId, "activity");
}
