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

/** The consignment's agreement row as it stands under its row lock. */
export type LockedAgreement = {
  id: string;
  legalEntityId: string;
  commissionPercent: string | null;
  acceptedAt: Date | null;
};

/** Another consignment's agreement already uses this signed PDF. */
export class SignedDocumentInUseError extends Error {
  constructor() {
    super("signed_document_in_use");
    this.name = "SignedDocumentInUseError";
  }
}

/** A second agreement for the consignment was inserted at the same time (its unique index). */
export class AgreementAlreadyRecordedError extends Error {
  constructor() {
    super("agreement_already_recorded");
    this.name = "AgreementAlreadyRecordedError";
  }
}

/**
 * Writes a recorded agreement: one per consignment, so recording over an existing one (unsigned,
 * without a commission, or being corrected) updates it in place and hands back what it was.
 */
export interface ISignedAgreementWriter {
  /**
   * The seller's settlement lock, the one a payout run holds: taken first, so a run and a
   * recording for the same seller happen one after the other.
   */
  lockSettlement(legalEntityId: string): Promise<void>;
  /** Then the sale's payment row and its seller-terms row, as the run takes them. */
  lockSale(sale: { paymentId: string; sellerTermsId: string | null }): Promise<void>;
  /** Then the consignment's agreement row, read as it stands under the lock. */
  lockAgreement(submissionId: string): Promise<LockedAgreement | null>;
  /**
   * Claims the signed PDF for this consignment's agreement: its upload row is locked and refused
   * (`SignedDocumentInUseError`) when another consignment's agreement already uses it. Once the
   * agreement stores it, that reference is the claim.
   */
  claimDocument(uploadObjectId: string, submissionId: string): Promise<void>;
  /** Throws `AgreementAlreadyRecordedError` when a concurrent insert won the unique index. */
  recordSigned(input: RecordSignedAgreementInput): Promise<RecordedAgreement>;
}
