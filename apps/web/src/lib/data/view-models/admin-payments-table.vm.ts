import type { AdminLotFulfilmentListRow, AdminPaymentRow } from "@/lib/data/http/admin.server";
import type { Lot, PaymentStatus } from "@auction/types";

export type AdminPaymentTableRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  status: PaymentStatus;
  fulfilmentStatus: string | null;
  xeroInvoiceNumber: string | null;
  xeroOnlineInvoiceUrl: string | null;
  xeroSyncStatus: "pending_sync" | "synced" | "error" | null;
  xeroLastError: string | null;
};

export function buildAdminPaymentTableRows(
  payments: AdminPaymentRow[],
  lots: Lot[],
  fulfilmentRows: AdminLotFulfilmentListRow[],
): AdminPaymentTableRow[] {
  const titleById = new Map(lots.map((a) => [a.id, a.title] as const));
  const fulfilmentByLotId = new Map(fulfilmentRows.map((r) => [r.lotId, r.status] as const));
  return payments.map((p) => ({
    id: p.id,
    lotId: p.lotId,
    lotTitle: titleById.get(p.lotId) ?? p.lotId,
    buyerId: p.buyerId,
    sellerId: p.sellerId,
    amount: p.amount,
    platformFee: p.platformFee,
    status: p.status,
    fulfilmentStatus: fulfilmentByLotId.get(p.lotId) ?? null,
    xeroInvoiceNumber: p.xeroInvoiceNumber,
    xeroOnlineInvoiceUrl: p.xeroOnlineInvoiceUrl,
    xeroSyncStatus: p.xeroSyncStatus,
    xeroLastError: p.xeroLastError,
  }));
}

export function filterPaymentTableRowsByStatus(
  rows: AdminPaymentTableRow[],
  status?: PaymentStatus,
): AdminPaymentTableRow[] {
  if (status === undefined) return rows;
  return rows.filter((r) => r.status === status);
}
