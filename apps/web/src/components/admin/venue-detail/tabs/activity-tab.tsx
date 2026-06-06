import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import { venueDetailTabHref } from "@/components/admin/venue-detail/venue-detail-types";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

type Props = {
  venueId: string;
};

export function VenueActivityTab({ venueId }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Activity"
      description="Timeline of changes and key events for this venue."
    >
      <ActivityContent venueId={venueId} />
    </CatalogDetailTabPanel>
  );
}

async function ActivityContent({ venueId }: { venueId: string }) {
  const events = await getAdminDomainEventsForAggregate({
    aggregateType: "venue",
    aggregateId: venueId,
    limit: 100,
  }).catch(() => []);

  return (
    <CatalogDomainEventsTimeline
      events={events}
      exportFilters={{ aggregateType: "venue", aggregateId: venueId }}
      showTechnicalDetails={false}
    />
  );
}

export function venueActivityTabHref(venueId: string): string {
  return venueDetailTabHref(venueId, "activity");
}
