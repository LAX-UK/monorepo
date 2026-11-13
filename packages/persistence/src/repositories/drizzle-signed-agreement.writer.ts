import type { Database } from "@auction/db";
import { consignmentAgreement } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";
import type {
  ISignedAgreementWriter,
  RecordSignedAgreementInput,
  RecordedAgreement,
} from "../interfaces/signed-agreement.writer.js";

/** Terms version of an agreement staff recorded from a signed paper copy. */
export const RECORDED_AGREEMENT_TERMS_VERSION = "recorded";

export class DrizzleSignedAgreementWriter implements ISignedAgreementWriter {
  constructor(private readonly db: Database | DbTransaction) {}

  async recordSigned(input: RecordSignedAgreementInput): Promise<RecordedAgreement> {
    const [previous] = await this.db
      .select({
        id: consignmentAgreement.id,
        legalEntityId: consignmentAgreement.legalEntityId,
        commissionPercent: consignmentAgreement.commissionPercent,
        acceptedAt: consignmentAgreement.acceptedAt,
        source: consignmentAgreement.source,
        signedDocumentId: consignmentAgreement.signedDocumentId,
      })
      .from(consignmentAgreement)
      .where(eq(consignmentAgreement.submissionId, input.submissionId))
      .for("update")
      .limit(1);
    const values = {
      legalEntityId: input.legalEntityId,
      commissionPercent: input.commissionPercent,
      acceptedAt: input.signedAt,
      acceptedByUserId: null,
      source: "recorded",
      recordedByUserId: input.recordedByUserId,
      signedDocumentId: input.signedDocumentId,
      recordReason: input.reason,
      updatedAt: new Date(),
    } as const;
    if (previous) {
      await this.db
        .update(consignmentAgreement)
        .set(values)
        .where(eq(consignmentAgreement.id, previous.id));
      return {
        agreementId: previous.id,
        replaced: {
          ...previous,
          commissionPercent:
            previous.commissionPercent === null ? null : String(previous.commissionPercent),
        },
      };
    }
    const [inserted] = await this.db
      .insert(consignmentAgreement)
      .values({
        ...values,
        submissionId: input.submissionId,
        termsVersion: RECORDED_AGREEMENT_TERMS_VERSION,
        proposedAt: input.signedAt,
      })
      .returning({ id: consignmentAgreement.id });
    if (!inserted) throw new Error("the recorded agreement was not stored");
    return { agreementId: inserted.id, replaced: null };
  }
}
