import type { AdminLotTableRow } from "@/components/admin/lots-board/types";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import type { LotDeleteEligibility, getAdminLotList } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";

type AdminLotListRow = Awaited<ReturnType<typeof getAdminLotList>>[number];

export function toAdminLotTableRow(a: AdminLotListRow): AdminLotTableRow {
  const deleteEligibility = (
    a as AdminLotListRow & { deleteEligibility?: LotDeleteEligibility | null }
  ).deleteEligibility;
  return {
    id: a.id,
    title: a.title,
    auctionType: a.auctionType,
    status: a.status,
    endTimeIso: a.endTime.toISOString(),
    endTimeLabel: formatDateTime(a.endTime),
    currentPrice: a.currentPrice,
    canDelete: deleteEligibility?.canDelete === true,
    ...(a.lifecycleSummary
      ? {
          lastActivityType: a.lifecycleSummary.lastEventType,
          lastActivityAt: a.lifecycleSummary.lastEventAt,
          lastActivityLabel: domainEventLabel(a.lifecycleSummary.lastEventType),
        }
      : {}),
  };
}

export function toAdminLotTableRows(rows: AdminLotListRow[]): AdminLotTableRow[] {
  return rows.map(toAdminLotTableRow);
}
