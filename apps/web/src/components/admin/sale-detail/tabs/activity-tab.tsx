import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

type Props = {
  saleId: string;
};

export function SaleActivityTab({ saleId }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Activity"
      description="Audit timeline for this sale — publish, cancel, and lifecycle events."
    >
      <ActivityContent saleId={saleId} />
    </CatalogDetailTabPanel>
  );
}

async function ActivityContent({ saleId }: { saleId: string }) {
  const events = await getAdminDomainEventsForAggregate({
    aggregateType: "sale",
    aggregateId: saleId,
    limit: 100,
  }).catch(() => []);

  return (
    <CatalogDomainEventsTimeline
      events={events}
      emptyMessage="No sale activity recorded yet. Events appear when the sale is published, cancelled, or ended."
    />
  );
}
