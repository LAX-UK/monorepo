import type {
  AdminManualReviewPaymentRow,
  ManualReviewPaymentBaseRow,
} from "./admin-read-models.js";

export interface IAdminManualReviewPaymentReader {
  listManualReviewPaymentRows(): Promise<ManualReviewPaymentBaseRow[]>;
  countManualReviewPayments(): Promise<number>;
}

export type { AdminManualReviewPaymentRow, ManualReviewPaymentBaseRow };
