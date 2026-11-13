import { saleSellerTerms } from "@auction/db/schema";
import type { SellerTermsFigures } from "@auction/types";

/** The snapshot's own figures to select for a seller's screens, joined beside the sale. */
export const SELLER_TERMS_FIGURE_COLUMNS = {
  figuresBasis: saleSellerTerms.basis,
  figuresHammerPence: saleSellerTerms.hammerPence,
  figuresCommissionBps: saleSellerTerms.commissionBps,
  figuresCommissionPence: saleSellerTerms.commissionPence,
  figuresVatTreatment: saleSellerTerms.commissionVatTreatment,
  figuresVatBps: saleSellerTerms.commissionVatBps,
  figuresVatPence: saleSellerTerms.commissionVatPence,
  figuresNetPence: saleSellerTerms.sellerNetPence,
} as const;

export type SellerTermsFiguresRow = {
  figuresBasis: string | null;
  figuresHammerPence: number | null;
  figuresCommissionBps: number | null;
  figuresCommissionPence: number | null;
  figuresVatTreatment: string | null;
  figuresVatBps: number | null;
  figuresVatPence: number | null;
  figuresNetPence: number | null;
};

/**
 * A priced snapshot's figures as recorded, or `null` when the sale has none (held, LAX's own
 * stock, or paid under the old rule). Never re-worked: the seller reads what the sale is paid on.
 */
export function sellerTermsFigures(row: SellerTermsFiguresRow): SellerTermsFigures | null {
  const treatment = row.figuresVatTreatment;
  if (
    row.figuresBasis !== "agreement" ||
    row.figuresHammerPence === null ||
    row.figuresCommissionBps === null ||
    row.figuresCommissionPence === null ||
    (treatment !== "standard" && treatment !== "not_registered") ||
    row.figuresVatBps === null ||
    row.figuresVatPence === null ||
    row.figuresNetPence === null
  ) {
    return null;
  }
  return {
    hammerPence: row.figuresHammerPence,
    commissionBps: row.figuresCommissionBps,
    commissionPence: row.figuresCommissionPence,
    vatTreatment: treatment,
    vatBps: row.figuresVatBps,
    vatPence: row.figuresVatPence,
    netPence: row.figuresNetPence,
  };
}
