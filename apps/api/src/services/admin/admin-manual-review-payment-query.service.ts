import type { AdminManualReviewPaymentRow } from "../../admin/admin-route-dtos.js";
import type { IAdminManualReviewPaymentEnrichmentReader } from "../../repositories/interfaces/admin-manual-review-payment-enrichment.reader.js";
import type { IAdminManualReviewPaymentReader } from "../../repositories/interfaces/admin-manual-review-payment.reader.js";
import type { IAdminManualReviewPaymentQueryService } from "../interfaces/admin-routes.js";

export class AdminManualReviewPaymentQueryService implements IAdminManualReviewPaymentQueryService {
  constructor(
    private readonly reader: IAdminManualReviewPaymentReader,
    private readonly enrichmentReader: IAdminManualReviewPaymentEnrichmentReader,
  ) {}

  async listManualReviewPayments(): Promise<AdminManualReviewPaymentRow[]> {
    const rows = await this.reader.listManualReviewPaymentRows();
    return this.enrichmentReader.enrich(rows);
  }

  countManualReviewPayments(): Promise<number> {
    return this.reader.countManualReviewPayments();
  }
}
