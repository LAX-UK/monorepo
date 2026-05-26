import { LotDetailShell } from "@/components/admin/lot-detail/lot-detail-shell";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import {
  getAdminDomainEventsForAggregate,
  getAdminLotLifecycle,
} from "@/lib/data/http/admin.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminLotDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const [bundle, bids, documents, activityEvents, lifecycle] = await Promise.all([
    loadAdminLotDetail(id),
    getServerLotBids(id, 100).catch(() => []),
    getServerLotDocuments(id).catch(() => []),
    getAdminDomainEventsForAggregate({ aggregateType: "lot", aggregateId: id, limit: 5 }).catch(
      () => [],
    ),
    getAdminLotLifecycle(id).catch(() => ({ snapshot: null, events: [] })),
  ]);

  return (
    <LotDetailShell
      lotId={id}
      bundle={bundle}
      bidCount={bids.length}
      documentCount={documents.length}
      activityEvents={activityEvents}
      lifecycle={lifecycle}
    >
      {children}
    </LotDetailShell>
  );
}
