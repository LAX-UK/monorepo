import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { ALL_LIVE_DOMAIN_EVENT_TYPES } from "@auction/types";

export type AuditActionOption = { value: string; label: string };

/**
 * Every event type the platform emits, as options for the log's action filter, sorted by what
 * staff read. Built on the server and passed down, so the event catalogue stays out of the
 * client bundle.
 */
export function auditActionOptions(): AuditActionOption[] {
  return [...new Set<string>(ALL_LIVE_DOMAIN_EVENT_TYPES)]
    .map((value) => ({ value, label: domainEventLabel(value) }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
}
