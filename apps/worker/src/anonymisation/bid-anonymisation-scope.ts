/** Who is being anonymised, resolved once so every rule works on the same set. */
export type BidAnonymisationScope = {
  /** The purged subject and every retired alias that was merged into it. */
  subjectIds: readonly string[];
  /** Individual legal entities created by the subject (their personal buyer or seller account). */
  personalLegalEntityIds: readonly string[];
  pseudonym: string;
  /** Years a private sale's record is kept after the deal ends; the default applies when unset. */
  privateSaleRecordRetentionYears?: number | undefined;
};
