/** A signed paper agreement staff record against a consignment. */
export type RecordSignedAgreementInput = {
  submissionId: string;
  /** The seller the agreement is with: the lot's seller. */
  legalEntityId: string;
  /** As stored: two decimals ("12.00"). */
  commissionPercent: string;
  signedAt: Date;
  signedDocumentId: string;
  reason: string;
  recordedByUserId: string;
};

/** The agreement as it stood before a recording replaced it, kept for the audit log. */
export type ReplacedAgreement = {
  id: string;
  legalEntityId: string;
  commissionPercent: string | null;
  acceptedAt: Date | null;
  source: string;
  signedDocumentId: string | null;
};

export type RecordedAgreement = { agreementId: string; replaced: ReplacedAgreement | null };

/**
 * Writes a recorded agreement: one per consignment, so recording over an existing one (unsigned,
 * without a commission, or being corrected) updates it in place and hands back what it was.
 */
export interface ISignedAgreementWriter {
  recordSigned(input: RecordSignedAgreementInput): Promise<RecordedAgreement>;
}
