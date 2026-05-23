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
      description="Audit timeline for taxonomy changes to this category."
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

  if (events.length === 0) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        No activity recorded yet. Changes to this category will appear here after staff edits.
      </p>
    );
  }

  return <CatalogDomainEventsTimeline events={events} />;
}

export function categoryActivityTabHref(categoryId: string): string {
  return categoryDetailTabHref(categoryId, "activity");
}
