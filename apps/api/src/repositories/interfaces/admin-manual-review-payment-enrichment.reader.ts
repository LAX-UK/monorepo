import type { AdminManualReviewPaymentRow } from "../../admin/admin-route-dtos.js";
import type { ManualReviewPaymentBaseRow } from "../../services/admin/manual-review-payment-enricher.js";

export interface IAdminManualReviewPaymentEnrichmentReader {
  enrich(rows: ManualReviewPaymentBaseRow[]): Promise<AdminManualReviewPaymentRow[]>;
}

export type { AdminManualReviewPaymentRow, ManualReviewPaymentBaseRow };
