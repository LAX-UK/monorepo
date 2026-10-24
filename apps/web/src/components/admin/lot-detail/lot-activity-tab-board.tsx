import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import type { AdminAuditLogRow } from "@/lib/data/http/admin-audit.schema";
import { Section } from "@auction/staff-ui";

type Props = {
  lotId: string;
  events: readonly AdminAuditLogRow[];
};

export function LotActivityTabBoard({ lotId: _lotId, events }: Props) {
  return (
    <Section
      title="Activity"
      description={`${events.length} ${events.length === 1 ? "event" : "events"} on this lot, newest first.`}
    >
      <AuditTimeline
        label="Lot activity"
        events={events}
        empty="No activity recorded for this lot yet."
      />
    </Section>
  );
}
