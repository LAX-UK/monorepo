import type { KycRecordKind, RetentionSubjectKind } from "../retention/kyc-retention-policy.js";

export type RetentionCandidate = {
  subjectId: string;
  closedAt: Date;
  lastActivityAt: Date | null;
};

export type RecordCounts = Partial<Record<KycRecordKind, number>>;

/** What a subject still holds: rows per record kind and the storage keys of their files. */
export type RetentionHolding = {
  records: RecordCounts;
  storageKeys: string[];
};

export type PurgeContext = {
  relationshipEndedAt: Date;
  purgedAt: Date;
};

/** One kind of subject (a person, an organisation) whose KYC records the purge can remove. */
export interface IKycRetentionSubjectStore {
  readonly kind: RetentionSubjectKind;
  /** Closed subjects that still hold records and were closed before the cutoff, by id order. */
  listCandidates(input: {
    closedBefore: Date;
    afterId: string | null;
    limit: number;
  }): Promise<RetentionCandidate[]>;
  describeHolding(subjectId: string): Promise<RetentionHolding>;
  /**
   * Deletes the subject's rows and writes one tombstone per record kind, in one transaction.
   * Stored files are deleted by the caller first, so a failure here leaves rows that a rerun
   * finds again.
   */
  erase(subjectId: string, context: PurgeContext): Promise<RecordCounts>;
}
