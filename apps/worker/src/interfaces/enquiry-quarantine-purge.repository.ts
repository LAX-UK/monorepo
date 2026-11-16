/** Deletes held inbound enquiry mail whose `purge_at` has passed. */
export interface IEnquiryQuarantinePurgeRepository {
  /**
   * Deletes up to `batchSize` held messages whose `purge_at` is at or before `now`, whatever their
   * review status. Returns how many were deleted and how many were picked for this batch.
   */
  purgeDue(now: Date, batchSize: number): Promise<{ deleted: number; batchCount: number }>;
}
