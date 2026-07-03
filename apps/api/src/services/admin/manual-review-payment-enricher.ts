import type { AdminManualReviewPaymentRow } from "../../admin/admin-route-dtos.js";

export type ManualReviewPaymentBaseRow = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  winnerUserId: string;
  winnerEmail: string;
  sellerLegalEntityId: string;
  sellerDisplayName: string;
  sellerStatus: string;
  sellerArchivedAt: Date | null;
  amount: string;
  createdAt: Date;
};

export type { AdminManualReviewPaymentRow };
