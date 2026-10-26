import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { venueDetailTabHref } from "@/components/admin/venue-detail/venue-detail-types";
import { ExportButton } from "@/components/exports/export-button";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { Section } from "@auction/staff-ui";

type Props = {
  venueId: string;
  events: readonly AdminDomainEventRow[];
};

export function VenueActivityTab({ venueId, events }: Props) {
  return (
    <Section
      title="Activity"
      description={`${events.length} ${events.length === 1 ? "event" : "events"} on this venue, newest first.`}
      action={
        <ExportButton
          entityType="domain-events"
          filters={{ aggregateType: "venue", aggregateId: venueId }}
        />
      }
    >
      <AuditTimeline
        label="Venue activity"
        events={events}
        empty="No activity recorded for this venue yet."
      />
    </Section>
  );
}

export function venueActivityTabHref(venueId: string): string {
  return venueDetailTabHref(venueId, "activity");
}
