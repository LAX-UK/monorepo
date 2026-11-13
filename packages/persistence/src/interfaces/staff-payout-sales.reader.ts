import type { SellerTermsHeldReason } from "@auction/domain";

/** The agreement a sale was paid under, as staff refer to it. */
export type StaffLineAgreement = {
  reference: string;
  submissionId: string;
  signedAt: Date | null;
  source: "online" | "recorded";
  /** As stored ("12.00"); read only to compare an old-rule payment with its agreement. */
  commissionPercent: string | null;
};

/** One sale on a payout, every figure as stored on its line and snapshot. */
export type StaffPayoutSaleLine = {
  lineId: string;
  paymentId: string;
  lotId: string;
  lotNumber: number | null;
  lotTitle: string;
  /** The line's amount: the hammer under the new rule, the buyer's payment under the old one. */
  amount: string;
  /** The snapshot the line pays; `null` on a line paid under the old rule. */
  terms: {
    hammerPence: number;
    commissionBps: number;
    commissionPence: number;
    commissionVatTreatment: "standard" | "not_registered";
    commissionVatBps: number;
    commissionVatPence: number;
    sellerNetPence: number;
  } | null;
  /** The buyer's payment and the fee taken from it, kept on old-rule lines. */
  oldRule: { paymentAmount: string; platformFee: string } | null;
  agreement: StaffLineAgreement | null;
};

/** A sale of the same seller still waiting for its agreement or setting. */
export type StaffHeldSale = {
  paymentId: string;
  sellerLegalEntityId: string;
  sellerName: string | null;
  lotId: string;
  lotNumber: number | null;
  lotTitle: string;
  heldReason: SellerTermsHeldReason;
  hammerPence: number;
};

export type StaffPayoutSales = {
  payout: {
    id: string;
    legalEntityId: string;
    status: string;
    createdAt: Date;
    processedAt: Date | null;
    grossAmount: string;
    platformFee: string;
    stripeFee: string;
    netAmount: string;
    /** Set on payouts paid under the signed agreement; null on old-rule payouts. */
    hammerAmount: string | null;
    commissionAmount: string | null;
    commissionVatAmount: string | null;
  };
  sales: StaffPayoutSaleLine[];
  /** The seller's held sales that are not on this payout. */
  heldForSeller: StaffHeldSale[];
};

/** A sale paid before seller payouts followed the signed agreement. */
export type StaffOldRuleSale = {
  lineId: string;
  payoutId: string;
  payoutCreatedAt: Date;
  paidAt: Date | null;
  legalEntityId: string;
  sellerName: string | null;
  lotId: string;
  lotNumber: number | null;
  lotTitle: string;
  /** What the buyer paid, and the old fee taken from it: the seller was paid the difference. */
  paymentAmount: string;
  platformFee: string;
  /** The hammer from the buyer's frozen invoice, when it has a hammer line. */
  hammerPence: number | null;
  agreement: StaffLineAgreement | null;
};

/** Reads payouts' sale lines for staff, as stored. Nothing here prices a sale. */
export interface IStaffPayoutSalesReader {
  forPayout(payoutId: string): Promise<StaffPayoutSales | null>;
  /** Every captured sale held for a missing fact and on no payout, across sellers. */
  heldSales(limit: number): Promise<StaffHeldSale[]>;
  oldRuleSales(page: { limit: number; offset: number }): Promise<{
    rows: StaffOldRuleSale[];
    total: number;
  }>;
}
