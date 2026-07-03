import type { AdminManualReviewPaymentRow } from "../../admin/admin-route-dtos.js";
import type { ManualReviewPaymentBaseRow } from "../../services/admin/manual-review-payment-enricher.js";

export interface IAdminManualReviewPaymentReader {
  listManualReviewPaymentRows(): Promise<ManualReviewPaymentBaseRow[]>;
  countManualReviewPayments(): Promise<number>;
}

export type { AdminManualReviewPaymentRow, ManualReviewPaymentBaseRow };
