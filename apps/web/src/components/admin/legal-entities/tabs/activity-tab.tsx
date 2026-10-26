import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { ExportButton } from "@/components/exports/export-button";
import type { AdminDomainEventRow } from "@/lib/data/http/admin-audit.schema";
import { Notice, Section } from "@auction/staff-ui";
import type { LegalEntity } from "@auction/types";

type Props = {
  entity: LegalEntity;
  activityEvents: readonly AdminDomainEventRow[];
  canViewActivity: boolean;
};

export function LegalEntityActivityTab({ entity, activityEvents, canViewActivity }: Props) {
  if (!canViewActivity) {
    return (
      <Notice tone="info" title="You do not have permission to view activity for this entity." />
    );
  }

  return (
    <Section
      title="Activity"
      description={`${activityEvents.length} ${activityEvents.length === 1 ? "event" : "events"} for this organisation: lifecycle, Stripe Connect and membership, newest first.`}
      action={
        <ExportButton
          entityType="domain-events"
          filters={{ aggregateType: "legal_entity", aggregateId: entity.id }}
        />
      }
    >
      <AuditTimeline
        label="Legal entity activity"
        events={activityEvents}
        empty="No activity recorded for this organisation yet."
      />
    </Section>
  );
}
