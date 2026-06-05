import type { telephoneBidBooking } from "@auction/db/schema";
import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";

type TelephoneBidBookingDbRow = typeof telephoneBidBooking.$inferSelect;

export function mapTelephoneBidBookingRow(row: TelephoneBidBookingDbRow): TelephoneBidBooking {
  return {
    id: row.id,
    saleId: row.saleId,
    userId: row.userId,
    buyerLegalEntityId: row.buyerLegalEntityId,
    phoneE164: row.phoneE164,
    lotIds: row.lotIds ?? [],
    authorizedMax: row.reserveAltMax != null ? String(row.reserveAltMax) : null,
    status: row.status as TelephoneBidBookingStatus,
    clerkUserId: row.clerkUserId ?? null,
    notes: row.notes ?? null,
    buyerNotes: row.buyerNotes ?? null,
    approvedByUserId: row.approvedByUserId ?? null,
    completedLotIds: row.completedLotIds ?? [],
    limitIncreaseRequestedAt: row.limitIncreaseRequestedAt ?? null,
    limitIncreaseAmount: row.limitIncreaseAmount != null ? String(row.limitIncreaseAmount) : null,
    cancelledAt: row.cancelledAt ?? null,
    cancelledByUserId: row.cancelledByUserId ?? null,
    cancellationReason: row.cancellationReason ?? null,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt ?? null,
    updatedAt: row.updatedAt,
  };
}

export function moneyToDbString(amount: number | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return amount.toFixed(2);
}

export function parseAuthorizedMaxCap(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
