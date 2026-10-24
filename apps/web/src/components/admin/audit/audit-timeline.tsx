import { toTimelineEvents } from "@/lib/admin/audit/audit-timeline";
import type { AdminAuditActor, AdminDomainEventRow } from "@/lib/data/http/admin-audit.schema";
import { Timeline } from "@auction/staff-ui";

/**
 * A record's activity, newest first: the one way lot, sale and other record pages render audit
 * events, so an event reads the same everywhere.
 */
export function AuditTimeline({
  events,
  label,
  empty,
  limit,
}: {
  events: readonly (AdminDomainEventRow & { actor?: AdminAuditActor | null })[];
  label: string;
  empty?: string;
  /** Show only the newest few, for an overview that links to the full list. */
  limit?: number;
}) {
  const timeline = toTimelineEvents(events);
  return (
    <Timeline
      label={label}
      events={limit ? timeline.slice(0, limit) : timeline}
      {...(empty ? { empty } : {})}
    />
  );
}
