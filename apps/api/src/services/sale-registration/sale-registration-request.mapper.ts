import type { saleRegistration } from "@auction/db/schema";
import type { SaleRegistrationRow } from "../interfaces/sale-registration-service.js";

export type SaleRegistrationDbRow = typeof saleRegistration.$inferSelect;

export function toBidLimitString(n: number | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toFixed(2);
}

export function mapSaleRegistrationRow(r: SaleRegistrationDbRow): SaleRegistrationRow {
  return {
    id: r.id,
    saleId: r.saleId,
    userId: r.userId,
    buyerLegalEntityId: r.buyerLegalEntityId,
    status: r.status as SaleRegistrationRow["status"],
    requestedAt: r.requestedAt,
    decidedAt: r.decidedAt,
    decidedByUserId: r.decidedByUserId,
    bidLimit: r.bidLimit,
    laxNotes: r.laxNotes,
    rejectionReason: r.rejectionReason,
    paddleNumber: r.paddleNumber,
    checkedInAt: r.checkedInAt,
  };
}
