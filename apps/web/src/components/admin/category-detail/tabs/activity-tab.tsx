import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

type Props = {
  categoryId: string;
};

export function CategoryActivityTab({ categoryId }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Activity"
      description="Timeline of changes and key events for this category."
    >
      <ActivityContent categoryId={categoryId} />
    </CatalogDetailTabPanel>
  );
}

async function ActivityContent({ categoryId }: { categoryId: string }) {
  const events = await getAdminDomainEventsForAggregate({
    aggregateType: "category",
    aggregateId: categoryId,
    limit: 100,
  }).catch(() => []);

  return (
    <CatalogDomainEventsTimeline
      events={events}
      exportFilters={{ aggregateType: "category", aggregateId: categoryId }}
      showTechnicalDetails={false}
    />
  );
}

export function categoryActivityTabHref(categoryId: string): string {
  return categoryDetailTabHref(categoryId, "activity");
}
