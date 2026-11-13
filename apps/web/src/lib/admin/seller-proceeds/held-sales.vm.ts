import type { HeldSaleDto } from "@/lib/data/http/admin-seller-proceeds.shared";
import { formatStaffMoney } from "@auction/staff-ui";
import { HELD_REASON_LABEL, heldReasonFixedByRecording, lotName } from "./held-reasons";
import type { RecordAgreementContext } from "./record-agreement.vm";

export type HeldSaleRow = {
  id: string;
  lot: string;
  lotTitle: string;
  lotHref: string;
  seller: string;
  sellerHref: string;
  hammer: string;
  reason: string;
  /** Set when recording the seller's signed agreement fixes it. */
  record: RecordAgreementContext | null;
};

export const HELD_SALES_EMPTY = "No sales are held";
export const HELD_SALES_NOTE =
  "Paid sales whose payout is held. Each joins the next payout once what it names is fixed; the rest of the seller's payout goes ahead.";

export function toHeldSaleRows(rows: readonly HeldSaleDto[]): HeldSaleRow[] {
  return rows.map((row) => {
    const lot = lotName(row);
    return {
      id: row.paymentId,
      lot,
      lotTitle: row.lotTitle,
      lotHref: `/admin/lots/${encodeURIComponent(row.lotId)}`,
      seller: row.sellerName ?? "Unknown seller",
      sellerHref: `/admin/legal-entities/${encodeURIComponent(row.sellerLegalEntityId)}`,
      hammer: formatStaffMoney(row.hammerPence),
      reason: HELD_REASON_LABEL[row.heldReason],
      record: heldReasonFixedByRecording(row.heldReason)
        ? {
            lotId: row.lotId,
            lot,
            lotTitle: row.lotTitle,
            sellerName: row.sellerName,
            hammerPence: row.hammerPence,
            vatSetting: null,
          }
        : null,
    };
  });
}
