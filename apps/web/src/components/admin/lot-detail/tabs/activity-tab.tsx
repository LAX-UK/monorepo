import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";
import Link from "next/link";

type Props = {
  lotId: string;
};

export function LotActivityTab({ lotId }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Activity"
      description="Audit timeline for this lot — lifecycle transitions, sale attachment, bids, and condition reports."
    >
      <ActivityContent lotId={lotId} />
      <p className="mt-6 font-body text-xs text-on-surface-variant">
        Bid-related events also appear here.{" "}
        <Link href={lotDetailTabHref(lotId, "bids")} className="text-primary hover:underline">
          View bid history →
        </Link>
      </p>
    </CatalogDetailTabPanel>
  );
}

async function ActivityContent({ lotId }: { lotId: string }) {
  const events = await getAdminDomainEventsForAggregate({
    aggregateType: "lot",
    aggregateId: lotId,
    limit: 100,
  }).catch(() => []);

  return <CatalogDomainEventsTimeline events={events} />;
}
