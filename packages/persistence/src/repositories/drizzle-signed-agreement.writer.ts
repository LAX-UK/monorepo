import type { Database } from "@auction/db";
import { consignmentAgreement, payment, saleSellerTerms, uploadObject } from "@auction/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";
import {
  AgreementAlreadyRecordedError,
  type ISignedAgreementWriter,
  type LockedAgreement,
  type RecordSignedAgreementInput,
  type RecordedAgreement,
  SignedDocumentInUseError,
} from "../interfaces/signed-agreement.writer.js";
import { supersedeAgreement } from "./agreement-version.js";
import { settlementLockSql } from "./drizzle-payout.repository.js";

const AGREEMENT_PER_SUBMISSION = "consignment_agreement_submission_id_uidx";

/** True when the error is the unique index that keeps one current agreement per consignment. */
function isSecondAgreement(err: unknown): boolean {
  const e = err as {
    code?: unknown;
    constraint?: unknown;
    cause?: { code?: unknown; constraint?: unknown };
  } | null;
  const pg = e?.code === "23505" ? e : e?.cause?.code === "23505" ? e.cause : null;
  return pg?.constraint === AGREEMENT_PER_SUBMISSION;
}

/** The consignment's current agreement: the version not superseded. */
function current(submissionId: string) {
  return and(
    eq(consignmentAgreement.submissionId, submissionId),
    isNull(consignmentAgreement.supersededAt),
  );
}

/** Terms version of an agreement staff recorded from a signed paper copy. */
export const RECORDED_AGREEMENT_TERMS_VERSION = "recorded";

export class DrizzleSignedAgreementWriter implements ISignedAgreementWriter {
  constructor(private readonly db: Database | DbTransaction) {}

  async lockSettlement(legalEntityId: string): Promise<void> {
    await this.db.execute(settlementLockSql(legalEntityId));
  }

  async lockSale(sale: { paymentId: string; sellerTermsId: string | null }): Promise<void> {
    await this.db
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.id, sale.paymentId))
      .for("update");
    if (sale.sellerTermsId) {
      await this.db
        .select({ id: saleSellerTerms.id })
        .from(saleSellerTerms)
        .where(eq(saleSellerTerms.id, sale.sellerTermsId))
        .for("update");
    }
  }

  async lockAgreement(submissionId: string): Promise<LockedAgreement | null> {
    const [row] = await this.db
      .select({
        id: consignmentAgreement.id,
        legalEntityId: consignmentAgreement.legalEntityId,
        commissionPercent: consignmentAgreement.commissionPercent,
        acceptedAt: consignmentAgreement.acceptedAt,
      })
      .from(consignmentAgreement)
      .where(current(submissionId))
      .for("update")
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      commissionPercent: row.commissionPercent === null ? null : String(row.commissionPercent),
    };
  }

  async claimDocument(uploadObjectId: string, submissionId: string): Promise<void> {
    await this.db
      .select({ id: uploadObject.id })
      .from(uploadObject)
      .where(eq(uploadObject.id, uploadObjectId))
      .for("update");
    const [other] = await this.db
      .select({ id: consignmentAgreement.id })
      .from(consignmentAgreement)
      .where(
        and(
          eq(consignmentAgreement.signedDocumentId, uploadObjectId),
          ne(consignmentAgreement.submissionId, submissionId),
        ),
      )
      .limit(1);
    if (other) throw new SignedDocumentInUseError();
  }

  async recordSigned(input: RecordSignedAgreementInput): Promise<RecordedAgreement> {
    try {
      return await this.write(input);
    } catch (err) {
      if (isSecondAgreement(err)) throw new AgreementAlreadyRecordedError();
      throw err;
    }
  }

  private async write(input: RecordSignedAgreementInput): Promise<RecordedAgreement> {
    const [previous] = await this.db
      .select()
      .from(consignmentAgreement)
      .where(current(input.submissionId))
      .for("update")
      .limit(1);
    const at = new Date();
    const values = {
      legalEntityId: input.legalEntityId,
      commissionPercent: input.commissionPercent,
      acceptedAt: input.signedAt,
      acceptedByUserId: null,
      source: "recorded",
      recordedByUserId: input.recordedByUserId,
      signedDocumentId: input.signedDocumentId,
      recordReason: input.reason,
    } as const;
    if (previous) {
      const replaced = {
        id: previous.id,
        legalEntityId: previous.legalEntityId,
        commissionPercent:
          previous.commissionPercent === null ? null : String(previous.commissionPercent),
        acceptedAt: previous.acceptedAt,
        source: previous.source,
        signedDocumentId: previous.signedDocumentId,
      };
      // A signed agreement is a record a sale may have been priced on: the correction is its next
      // version. An unsigned proposal has priced nothing, so it is completed in place.
      if (previous.acceptedAt !== null) {
        const agreementId = await supersedeAgreement(
          this.db,
          previous,
          { ...values, replacesAgreementId: previous.id },
          at,
        );
        return { agreementId, replaced };
      }
      await this.db
        .update(consignmentAgreement)
        .set({ ...values, updatedAt: at })
        .where(eq(consignmentAgreement.id, previous.id));
      return { agreementId: previous.id, replaced };
    }
    const [inserted] = await this.db
      .insert(consignmentAgreement)
      .values({
        ...values,
        updatedAt: at,
        submissionId: input.submissionId,
        termsVersion: RECORDED_AGREEMENT_TERMS_VERSION,
        proposedAt: input.signedAt,
      })
      .returning({ id: consignmentAgreement.id });
    if (!inserted) throw new Error("the recorded agreement was not stored");
    return { agreementId: inserted.id, replaced: null };
  }
}
