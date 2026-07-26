import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import type { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

type Props = {
  categoryId: string;
  events: Awaited<ReturnType<typeof getAdminDomainEventsForAggregate>>;
};

export function CategoryActivityTab({ categoryId, events }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Activity"
      description="Timeline of changes and key events for this category."
    >
      <CatalogDomainEventsTimeline
        events={events}
        exportFilters={{ aggregateType: "category", aggregateId: categoryId }}
        showTechnicalDetails={false}
      />
    </CatalogDetailTabPanel>
  );
}

export function categoryActivityTabHref(categoryId: string): string {
  return categoryDetailTabHref(categoryId, "activity");
}
