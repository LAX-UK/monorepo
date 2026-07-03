import type {
  AdminManualReviewPaymentRow,
  ManualReviewPaymentBaseRow,
} from "./admin-read-models.js";

export interface IAdminManualReviewPaymentEnrichmentReader {
  enrich(rows: ManualReviewPaymentBaseRow[]): Promise<AdminManualReviewPaymentRow[]>;
}

export type { AdminManualReviewPaymentRow, ManualReviewPaymentBaseRow };
