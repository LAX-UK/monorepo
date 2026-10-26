import { LotDetailShell } from "@/components/admin/lot-detail/lot-detail-shell";
import { computeLotDetailReadiness } from "@/lib/admin/compute-lot-detail-readiness";
import { loadLotConnectRequired } from "@/lib/admin/connect-readiness";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { withdrawalsListController } from "@/lib/admin/withdrawals-list-controller";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAtgLotSellingSummaries } from "@/lib/data/http/atg.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import {
  LOTS_ACCESS,
  SALES_ACCESS,
  WITHDRAWAL_DECISION_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminLotDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(LOTS_ACCESS, `/admin/lots/${id}`);
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const canManageCatalog = userHasAccessTo(role, staffRole, LOTS_ACCESS);
  const canManageAuction = userHasAccessTo(role, staffRole, SALES_ACCESS);
  const canDecideWithdrawals = userHasAccessTo(role, staffRole, WITHDRAWAL_DECISION_ACCESS);
  const [bundle, bids, documents, connectRequired, withdrawalTasks, selling] = await Promise.all([
    loadAdminLotDetail(id),
    getServerLotBids(id, 100).catch(() => []),
    getServerLotDocuments(id).catch(() => []),
    loadLotConnectRequired(id),
    canDecideWithdrawals
      ? withdrawalsListController.fetch().then(
          (result) => result.tasks,
          () => [],
        )
      : Promise.resolve([]),
    canManageAuction
      ? getAtgLotSellingSummaries([id]).then((rows) => rows.get(id) ?? null)
      : Promise.resolve(null),
  ]);

  const publishReadiness = computeLotDetailReadiness({
    lotId: id,
    auction: bundle.auction,
    context: bundle.context,
    connectRequired,
  });
  const withdrawal = withdrawalTasks.find((task) => task.targetLotId === id);

  return (
    <LotDetailShell
      lotId={id}
      bundle={bundle}
      bidCount={bids.length}
      documentCount={documents.length}
      canManageCatalog={canManageCatalog}
      canManageAuction={canManageAuction}
      canDecideWithdrawals={canDecideWithdrawals}
      withdrawalRequestedAt={withdrawal ? new Date(withdrawal.createdAt).toISOString() : null}
      connectRequired={connectRequired}
      publishReadiness={publishReadiness}
      selling={selling}
    >
      {children}
    </LotDetailShell>
  );
}
