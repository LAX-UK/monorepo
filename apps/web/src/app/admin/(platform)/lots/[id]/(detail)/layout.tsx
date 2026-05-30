import { LotDetailShell } from "@/components/admin/lot-detail/lot-detail-shell";
import { computeLotDetailReadiness } from "@/lib/admin/compute-lot-detail-readiness";
import { loadLotConnectRequired } from "@/lib/admin/connect-readiness";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  getAdminDomainEventsForAggregate,
  getAdminLotLifecycle,
} from "@/lib/data/http/admin.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminLotDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(LOTS_ACCESS, `/admin/lots/${id}`);
  const canManageCatalog = userHasAccessTo(
    user.role as UserRole,
    user.staffRole ?? null,
    LOTS_ACCESS,
  );
  const canManageAuction = userHasAccessTo(
    user.role as UserRole,
    user.staffRole ?? null,
    SALES_ACCESS,
  );
  const [bundle, bids, documents, activityEvents, lifecycle, connectRequired] = await Promise.all([
    loadAdminLotDetail(id),
    getServerLotBids(id, 100).catch(() => []),
    getServerLotDocuments(id).catch(() => []),
    getAdminDomainEventsForAggregate({ aggregateType: "lot", aggregateId: id, limit: 5 }).catch(
      () => [],
    ),
    getAdminLotLifecycle(id).catch(() => ({ snapshot: null, events: [] })),
    loadLotConnectRequired(id),
  ]);

  const publishReadiness = computeLotDetailReadiness({
    lotId: id,
    auction: bundle.auction,
    context: bundle.context,
    connectRequired,
  });

  return (
    <LotDetailShell
      lotId={id}
      bundle={bundle}
      bidCount={bids.length}
      documentCount={documents.length}
      activityEvents={activityEvents}
      lifecycle={lifecycle}
      canManageCatalog={canManageCatalog}
      canManageAuction={canManageAuction}
      connectRequired={connectRequired}
      publishReadiness={publishReadiness}
    >
      {children}
    </LotDetailShell>
  );
}
