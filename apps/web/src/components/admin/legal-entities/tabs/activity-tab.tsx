import { CatalogDomainEventsTimeline, DetailBoardShell } from "@/components/admin/catalog";
import type { AdminDomainEventRow } from "@/lib/data/http/admin-audit.schema";
import type { LegalEntity } from "@auction/types";

type Props = {
  entity: LegalEntity;
  activityEvents: readonly AdminDomainEventRow[];
  canViewActivity: boolean;
};

export function LegalEntityActivityTab({ entity, activityEvents, canViewActivity }: Props) {
  if (!canViewActivity) {
    return (
      <DetailBoardShell title="Activity" description="Audit timeline for this organisation.">
        <p className="font-body text-sm text-on-surface-variant">
          You do not have permission to view activity for this entity.
        </p>
      </DetailBoardShell>
    );
  }

  return (
    <div className="space-y-6">
      <DetailBoardShell
        title="Activity"
        description="Timeline of lifecycle, Stripe Connect, and membership events for this organisation."
        count={activityEvents.length}
      >
        <CatalogDomainEventsTimeline
          events={activityEvents}
          exportFilters={{ aggregateType: "legal_entity", aggregateId: entity.id }}
          showTechnicalDetails={false}
        />
      </DetailBoardShell>
    </div>
  );
}
