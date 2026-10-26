import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import { ExportButton } from "@/components/exports/export-button";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { Section } from "@auction/staff-ui";

type Props = {
  categoryId: string;
  events: readonly AdminDomainEventRow[];
};

export function CategoryActivityTab({ categoryId, events }: Props) {
  return (
    <Section
      title="Activity"
      description={`${events.length} ${events.length === 1 ? "event" : "events"} on this category, newest first.`}
      action={
        <ExportButton
          entityType="domain-events"
          filters={{ aggregateType: "category", aggregateId: categoryId }}
        />
      }
    >
      <AuditTimeline
        label="Category activity"
        events={events}
        empty="No activity recorded for this category yet."
      />
    </Section>
  );
}

export function categoryActivityTabHref(categoryId: string): string {
  return categoryDetailTabHref(categoryId, "activity");
}
