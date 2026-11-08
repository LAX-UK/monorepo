/** One erasure of a person's enquiries that answered a data request. */
export type DataRequestErasureEntry = {
  at: Date;
  actorName: string | null;
  /** Enquiries anonymised by this erasure. */
  enquiries: number;
};

/**
 * Bid's own record of the erasures done for a request. Identity has no endpoint for adding a
 * timeline note, so the request page's History is completed from these rows.
 */
export interface IDataRequestErasureHistory {
  forReference(reference: string): Promise<DataRequestErasureEntry[]>;
}
