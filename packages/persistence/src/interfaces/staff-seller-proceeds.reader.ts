import type { CommissionVatTreatment, SellerTermsHeldReason } from "@auction/domain";

/** How a snapshot was made: when the invoice was raised, priced again at payout, or released by a recorded agreement. */
export type StaffSellerTermsSource = "raised" | "recomputed_at_payout" | "agreement_recorded";

/** A sale's seller-terms snapshot as stored. Figures a basis does not carry are `null`. */
export type StaffSellerTermsFacts = {
  id: string;
  basis: "agreement" | "lax_owned" | "held";
  heldReason: SellerTermsHeldReason | null;
  source: StaffSellerTermsSource;
  hammerPence: number;
  premiumPence: number;
  commissionBps: number | null;
  commissionPence: number | null;
  commissionVatTreatment: CommissionVatTreatment | null;
  commissionVatBps: number | null;
  commissionVatPence: number | null;
  sellerNetPence: number | null;
  /** The old-rule fee, kept when a payment raised before the rule was priced again at payout. */
  legacyPlatformFeePence: number | null;
  computedAt: Date;
};

/** The consignment agreement behind a lot, as staff refer to it. */
export type StaffAgreementFacts = {
  id: string;
  submissionId: string;
  /** "C-1042": the consignment's reference. */
  reference: string;
  legalEntityId: string;
  /** When the seller accepted, or the date staff recorded it as signed. */
  signedAt: Date | null;
  commissionPercent: string | null;
  source: "online" | "recorded";
};

/** The buyer's frozen invoice, as far as the seller's side needs it. */
export type StaffInvoiceFacts = {
  totalPence: number;
  premiumPence: number;
  /** The premium rate stated on the invoice line, as stored ("25.000"); null when the line has none. */
  premiumRatePercent: string | null;
};

/** The payout a sale was paid on, when it is on one. */
export type StaffSalePayoutFacts = {
  id: string;
  status: string;
  processedAt: Date | null;
};

/** The live sale of a lot: its buyer payment and everything the seller's side is read from. */
export type StaffLotSaleFacts = {
  paymentId: string;
  paymentStatus: string;
  terms: StaffSellerTermsFacts | null;
  invoice: StaffInvoiceFacts | null;
  payout: StaffSalePayoutFacts | null;
  /** A refund charged back to the seller after the sale was paid out. */
  refundedAfterPayout: boolean;
  /** The payment came from re-awarding the lot to the next bidder. */
  reawarded: boolean;
};

/** Everything the staff "Seller proceeds" section and the held notice read for one lot. */
export type StaffLotSellerProceedsFacts = {
  lotId: string;
  lotNumber: number | null;
  lotTitle: string;
  sellerLegalEntityId: string | null;
  sellerName: string | null;
  soldOnAtg: boolean;
  sale: StaffLotSaleFacts | null;
  /** The agreement on the sale's snapshot, or (when it is held) the lot's agreement, if any. */
  agreement: StaffAgreementFacts | null;
  /** The submission a signed agreement would be recorded against, when the lot came from one. */
  submissionId: string | null;
  vatSetting: CommissionVatTreatment | null;
};

/** Reads the seller's side of a lot for staff. Read-only: nothing here prices a sale. */
export interface IStaffLotSellerProceedsReader {
  forLot(lotId: string): Promise<StaffLotSellerProceedsFacts | null>;
}

/** How staff name a sale on a list: the lot, and the agreement its rate comes from. */
export type StaffSaleLabel = {
  lotId: string;
  lotNumber: number | null;
  lotTitle: string;
  /** The lot's agreement (the seller's own first), if there is one. */
  agreement: Pick<
    StaffAgreementFacts,
    "id" | "reference" | "submissionId" | "signedAt" | "source"
  > | null;
};

/** Names the lots of several sales at once, for previews and payout lines. */
export interface IStaffSaleLabelsReader {
  saleLabels(lotIds: readonly string[]): Promise<StaffSaleLabel[]>;
}
