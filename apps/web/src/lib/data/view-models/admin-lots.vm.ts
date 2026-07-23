import type { AdminLotTableRow } from "@/lib/admin/catalog/lot-table-row";
import {
  formatLotEstimateDisplay,
  formatLotHammerForTable,
} from "@/lib/admin/lots/lot-catalog-presenters";
import type { LotDeleteEligibility, getAdminLotList } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import type { SaleDeliveryMode, SaleStatus } from "@auction/types";
import { toRequiredIsoString } from "@auction/validators";

type AdminLotListRow = Awaited<ReturnType<typeof getAdminLotList>>[number];

export type AdminLotSaleContext = {
  title: string;
  status: SaleStatus;
  deliveryMode: SaleDeliveryMode;
};

export type AdminLotTableRowOptions = {
  saleContextById?: ReadonlyMap<string, AdminLotSaleContext>;
  artistNameById?: ReadonlyMap<string, string>;
};

export function toAdminLotTableRow(
  a: AdminLotListRow,
  options?: AdminLotTableRowOptions,
): AdminLotTableRow {
  const deleteEligibility = (
    a as AdminLotListRow & { deleteEligibility?: LotDeleteEligibility | null }
  ).deleteEligibility;
  const saleId = a.saleId?.trim() ? a.saleId : null;
  const saleContext = saleId ? options?.saleContextById?.get(saleId) : undefined;
  const artistId = a.artistId?.trim() ? a.artistId : null;
  return {
    id: a.id,
    title: a.title,
    lotNumber: a.lotNumber ?? null,
    thumbnailUrl: a.images[0]?.trim() ? a.images[0] : null,
    estimateDisplay: formatLotEstimateDisplay(a),
    imageCount: a.images.length,
    artistLabel: artistId ? (options?.artistNameById?.get(artistId) ?? null) : null,
    saleId,
    saleTitle: saleContext?.title ?? null,
    saleStatus: saleContext?.status ?? null,
    saleDeliveryMode: saleContext?.deliveryMode ?? null,
    auctionType: a.auctionType,
    status: a.status,
    endTimeIso: toRequiredIsoString(a.endTime),
    endTimeLabel: formatDateTime(a.endTime),
    hammerDisplay: formatLotHammerForTable(a),
    canDelete: deleteEligibility?.canDelete === true,
  };
}

export function toAdminLotTableRows(
  rows: AdminLotListRow[],
  options?: AdminLotTableRowOptions,
): AdminLotTableRow[] {
  return rows.map((row) => toAdminLotTableRow(row, options));
}
